import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType, MovementType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ConvertDocumentDto,
  CreateDocumentDto,
  CreateDocumentItemDto,
  FindAllDocumentsDto,
  ReleaseItemsDto,
  UpdateDocumentDto,
} from './dto/index';
import { assertAvailableForReservation } from './helpers/reservation.helpers';
import {
  applyBinStockChange,
  applyStockChange,
  computeReversedAvgCost,
  resolveLastCostAfterVoidingCm,
} from './helpers/stock.helpers';
import { matchItemsByProduct } from './helpers/conversion.helpers';
import {
  DocumentEffectsRegistry,
  isReservationStrategy,
} from './strategies/index';

const DETAIL_INCLUDE = {
  documentItems: {
    include: {
      product: {
        select: {
          id: true,
          code: true,
          description: true,
          avgCost: true,
          unitOfMeasure: true,
        },
      },
    },
  },
  // supplier.brands se incluye para que editar un CM/DVC ya cargue las marcas
  // del proveedor (sin esto el buscador/escaneo de producto queda deshabilitado).
  thirdParty: {
    select: {
      id: true,
      name: true,
      supplier: {
        select: {
          discountNotes: true,
          brands: {
            where: { active: true },
            select: { id: true, name: true },
          },
        },
      },
    },
  },
  seller: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  confirmedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  destWarehouse: { select: { id: true, name: true } },
  destBin: { include: { zone: { select: { name: true } } } },
  sourceDocument: { select: { id: true, type: true, number: true } },
} satisfies Prisma.DocumentInclude;

// Include recortado para impresión: solo lo que el PDF de CM/DVC muestra (a
// diferencia de DETAIL_INCLUDE). Excluye product.avgCost a propósito — el PDF
// usa documentItem.unitCost (costo transaccional), mezclarlo con el costo
// promedio live sería un bug de negocio.
const PRINT_INCLUDE = {
  documentItems: {
    include: {
      product: {
        select: { id: true, code: true, description: true, unitOfMeasure: true },
      },
    },
  },
  thirdParty: {
    select: {
      id: true,
      name: true,
      documentType: true,
      documentNumber: true,
      address: true,
      phone: true,
    },
  },
  user: { select: { id: true, name: true } },
} satisfies Prisma.DocumentInclude;

export type DocumentForPrint = Prisma.DocumentGetPayload<{
  include: typeof PRINT_INCLUDE;
}>;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectsRegistry: DocumentEffectsRegistry,
  ) {}

  async findAll(findAllDocumentsDto: FindAllDocumentsDto) {
    const {
      page = 1,
      limit = 20,
      type,
      types,
      status,
      dateFrom,
      dateTo,
      search,
      thirdPartyId,
    } = findAllDocumentsDto;
    const skip = (page - 1) * limit;

    const typeList = types
      ? (types.split(',').filter(Boolean) as DocumentType[])
      : undefined;

    const where: Prisma.DocumentWhereInput = {
      ...(typeList?.length ? { type: { in: typeList } } : type && { type }),
      ...(status && { status }),
      ...((dateFrom || dateTo) && {
        date: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
      ...(search && { number: { contains: search } }),
      ...(thirdPartyId && { thirdPartyId }),
    };

    const [items, total, draftCount, confirmedCount] =
      await this.prisma.$transaction([
        this.prisma.document.findMany({
          where,
          include: {
            thirdParty: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
            warehouse: { select: { id: true, name: true } },
            destWarehouse: { select: { id: true, name: true } },
            _count: { select: { documentItems: true } },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.document.count({ where }),
        this.prisma.document.count({
          where: { ...where, status: DocumentStatus.draft },
        }),
        this.prisma.document.count({
          where: { ...where, status: DocumentStatus.confirmed },
        }),
      ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        draftCount,
        confirmedCount,
      },
    };
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    return document;
  }

  /** Datos mínimos para el PDF de impresión (usada por DocumentPrintService). Solo documentos confirmados: un borrador puede seguir cambiando y un PDF de algo no definitivo induce a error. */
  async getDocumentForPrint(id: string): Promise<DocumentForPrint> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: PRINT_INCLUDE,
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    if (document.status !== DocumentStatus.confirmed) {
      throw new BadRequestException(
        'Solo se pueden imprimir documentos confirmados',
      );
    }

    return document;
  }

  async create(createDocumentDto: CreateDocumentDto, user: JwtPayload) {
    const {
      type,
      date,
      items,
      thirdPartyId,
      sellerId,
      destWarehouseId,
      destBinId,
      sourceBinId,
      notes,
      adjustmentReason,
      adjustmentReasonOther,
      paymentMethod,
      ...rest
    } = createDocumentDto;

    this.assertDocumentPermission(user, type);

    // Lanza BadRequestException si el tipo aún no tiene estrategia (fase 2).
    const strategy = this.effectsRegistry.get(type);

    await strategy.validateCreate?.(createDocumentDto);

    let warehouseId: string | undefined;

    // Solo T mueve stock entre bodegas elegidas por el usuario; el resto opera
    // siempre sobre la tienda activa, así que el cliente nunca envía warehouseId salvo para T.
    if (type !== DocumentType.T) {
      const store = await this.prisma.warehouse.findFirst({
        where: { type: 'store', active: true },
      });
      if (!store) {
        throw new BadRequestException(
          'No existe una tienda activa para asignar al documento',
        );
      }
      warehouseId = store.id;
    } else {
      warehouseId = rest.warehouseId;
    }

    const document = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextNumber(tx, type);
      const total = this.computeTotal(items, type);

      return tx.document.create({
        data: {
          type,
          number,
          date: new Date(date),
          thirdPartyId,
          sellerId,
          userId: user.sub,
          status: DocumentStatus.draft,
          total,
          notes,
          warehouseId,
          destWarehouseId,
          destBinId,
          sourceBinId,
          adjustmentReason,
          adjustmentReasonOther,
          paymentMethod: paymentMethod ?? null,
          documentItems: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost ?? 0,
              unitPrice: item.unitPrice ?? 0,
              subtotal: this.computeItemSubtotal(item, type),
              observaciones: item.observaciones ?? null,
            })),
          },
        },
        include: DETAIL_INCLUDE,
      });
    });

    return document;
  }

  async update(
    id: string,
    updateDocumentDto: UpdateDocumentDto,
    user: JwtPayload,
  ) {
    const document = await this.prisma.document.findUnique({ where: { id } });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    this.assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.draft) {
      throw new ConflictException(
        'Solo se pueden editar documentos en borrador',
      );
    }

    const { items, date, ...rest } = updateDocumentDto;

    // A diferencia de create(), NO corre strategy.validateCreate: un borrador
    // se edita sin volver a validar. Por eso TransferEffectStrategy.confirm
    // revalida bin/bodega desde cero antes de aplicar efectos.
    return this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.documentItem.deleteMany({ where: { documentId: id } });
        await tx.documentItem.createMany({
          data: items.map((item) => ({
            documentId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost ?? 0,
            unitPrice: item.unitPrice ?? 0,
            subtotal: this.computeItemSubtotal(item, document.type),
            observaciones: item.observaciones ?? null,
          })),
        });
      }

      return tx.document.update({
        where: { id },
        data: {
          ...rest,
          ...(date && { date: new Date(date) }),
          ...(items && { total: this.computeTotal(items, document.type) }),
        },
        include: DETAIL_INCLUDE,
      });
    });
  }

  async confirm(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: { include: { product: true } },
        thirdParty: { include: { supplier: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    this.assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.draft) {
      throw new ConflictException(
        'Solo se pueden confirmar documentos en borrador',
      );
    }

    if (document.documentItems.length === 0) {
      throw new BadRequestException(
        'El documento no tiene ítems para confirmar',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        // Bloqueo optimista: si otro proceso confirmó/anuló el doc, no aplicar efectos.
        const claimed = await tx.document.updateMany({
          where: { id, status: DocumentStatus.draft },
          data: { status: DocumentStatus.confirmed, confirmedById: user.sub },
        });

        if (claimed.count === 0) {
          throw new ConflictException(
            'Solo se pueden confirmar documentos en borrador',
          );
        }

        await this.effectsRegistry
          .get(document.type)
          .confirm(tx, document, user.sub);

        // Si nació de convertir una PV (sourceDocumentId), descuenta lo consumido
        // de la reserva original en la misma transacción — la conversión queda atómica.
        if (document.sourceDocumentId) {
          const source = await tx.document.findUnique({
            where: { id: document.sourceDocumentId },
            include: {
              documentItems: { include: { product: true } },
              thirdParty: { include: { supplier: true } },
            },
          });

          if (source) {
            const sourceStrategy = this.effectsRegistry.get(source.type);
            if (isReservationStrategy(sourceStrategy)) {
              const conversions = matchItemsByProduct(
                source.documentItems,
                document.documentItems,
              );
              await sourceStrategy.consumeForConversion(
                tx,
                source,
                conversions,
                user.sub,
              );
            }
          }
        }
      },
      { timeout: 30000 },
    );

    return this.findOne(id);
  }

  /**
   * La anulación NO usa estrategias: es genérica por diseño — reversa los
   * movimientos kardex registrados y elimina las CxP del documento, sin
   * importar el tipo. Si algún tipo futuro necesita reversa especial,
   * recién ahí se agrega un hook a la estrategia.
   */
  async void(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: { select: { id: true, productId: true, quantity: true } },
        inventoryMovements: {
          include: { documentItem: { select: { unitCost: true } } },
        },
        accountsPayable: {
          include: { payablePayments: true, creditApplications: true },
        },
        supplierCredits: { include: { applications: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    this.assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.confirmed) {
      throw new ConflictException(
        'Solo se pueden anular documentos confirmados',
      );
    }

    // Un pago puede saldarse 100% con nota crédito (amount=0, sin fila
    // PayablePayment) — sin mirar creditApplications ese caso no bloquea el
    // void y termina reventando con un error crudo de FK más abajo.
    const hasPayments = document.accountsPayable.some(
      (payable) =>
        payable.payablePayments.length > 0 ||
        payable.creditApplications.length > 0,
    );

    if (hasPayments) {
      throw new ConflictException(
        'No se puede anular: la cuenta por pagar ya tiene pagos registrados',
      );
    }

    // Si la nota crédito que generó este DVC ya fue aplicada a otra cuenta
    // por pagar, anular el documento la dejaría huérfana pero igual gastable.
    const hasCreditApplications = document.supplierCredits.some(
      (credit) => credit.applications.length > 0,
    );

    if (hasCreditApplications) {
      throw new ConflictException(
        'No se puede anular: la nota crédito generada por este documento ya fue aplicada a un pago',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        const claimed = await tx.document.updateMany({
          where: { id, status: DocumentStatus.confirmed },
          data: { status: DocumentStatus.voided, voidedById: user.sub },
        });

        if (claimed.count === 0) {
          throw new ConflictException(
            'Solo se pueden anular documentos confirmados',
          );
        }

        // Tipos con reserva lógica (hoy solo PV): anular libera toda la reserva
        // de golpe, pero eso pasaba sin registrar — a diferencia de /release-items,
        // que sí anota en ReservationRelease. Este bloque deja el mismo registro.
        const strategy = this.effectsRegistry.get(document.type);
        if (isReservationStrategy(strategy)) {
          // Releída con tx (no el documentItems cargado antes de abrir la
          // transacción): si /release-items corrió en esa ventana, el dato de
          // afuera quedaría desactualizado y este bloque liberaría de más.
          const freshItems = await tx.documentItem.findMany({
            where: { documentId: id },
            select: {
              id: true,
              quantity: true,
              releasedQuantity: true,
              convertedQuantity: true,
            },
          });

          const releases = freshItems
            .map((item) => ({
              documentItemId: item.id,
              quantity:
                item.quantity - item.releasedQuantity - item.convertedQuantity,
            }))
            .filter((release) => release.quantity > 0);

          if (releases.length > 0) {
            await tx.reservationRelease.createMany({
              data: releases.map((release) => ({
                documentItemId: release.documentItemId,
                quantity: release.quantity,
                userId: user.sub,
                notes: 'Liberación automática por anulación del documento',
              })),
            });
          }
        }

        // Si nació de convertir una PV (sourceDocumentId), hay que devolverle las
        // unidades marcadas como convertidas — si no, quedarían "convertidas" para
        // siempre y esa reserva nunca volvería a estar disponible.
        if (document.sourceDocumentId) {
          const source = await tx.document.findUnique({
            where: { id: document.sourceDocumentId },
            select: { type: true },
          });

          if (source) {
            const sourceStrategy = this.effectsRegistry.get(source.type);
            if (isReservationStrategy(sourceStrategy)) {
              for (const item of document.documentItems) {
                const sourceItem = await tx.documentItem.findFirst({
                  where: {
                    documentId: document.sourceDocumentId,
                    productId: item.productId,
                  },
                });

                if (sourceItem) {
                  await tx.$queryRaw`
                    UPDATE document_item
                    SET converted_quantity = GREATEST(converted_quantity - ${item.quantity}, 0)
                    WHERE id = ${sourceItem.id}::uuid
                  `;
                }
              }
            }
          }
        }

        // avgCost solo se reversa para CM/EAI (únicos tipos que lo re-ponderan al
        // confirmar) y solo si el movimiento a anular es el más reciente del
        // producto — ver computeReversedAvgCost para el porqué.
        // Memoizada por productId: un CM/EAI con varias líneas del mismo producto
        // repetiría la misma query — segura de cachear porque filtra documentId: { not: id }.
        const recentConsumptionCache = new Map<
          string,
          Awaited<ReturnType<typeof tx.inventoryMovement.findFirst>>
        >();

        // Cacheada por warehouseId: varias líneas del mismo documento casi
        // siempre comparten bodega, evita repetir la consulta de tipo por línea.
        const warehouseTypeCache = new Map<string, string>();

        for (const movement of document.inventoryMovements) {
          const quantity = movement.quantity;
          const isCostAffecting =
            document.type === DocumentType.CM ||
            (document.type === DocumentType.EAI &&
              Number(movement.documentItem?.unitCost ?? 0) > 0);

          if (isCostAffecting) {
            // Varias líneas del mismo CM/EAI comparten documentId — se excluyen
            // del chequeo de recencia comparando createdAt (no el id, para no
            // depender del orden de iteración). Solo bloquea consumo real
            // (quantity < 0, ej. DVC/SAJ): un traslado (T) no cuenta porque su
            // neto es cero, y un void tampoco porque revertir una compra/EAI
            // anterior no es consumo real (misma asociatividad) — sin excluirlo,
            // anular CM1 y luego CM2 del mismo producto fallaba sin motivo.
            let mostRecentOther = recentConsumptionCache.get(
              movement.productId,
            );

            if (mostRecentOther === undefined) {
              mostRecentOther = await tx.inventoryMovement.findFirst({
                where: {
                  productId: movement.productId,
                  documentId: { not: id },
                  quantity: { lt: 0 },
                  movementType: {
                    notIn: [MovementType.transfer, MovementType.void],
                  },
                },
                orderBy: { createdAt: 'desc' },
              });
              recentConsumptionCache.set(movement.productId, mostRecentOther);
            }

            if (
              mostRecentOther &&
              mostRecentOther.createdAt > movement.createdAt
            ) {
              throw new ConflictException(
                `No se puede anular: el producto ${movement.productId} tuvo movimientos de stock posteriores a esta compra/ajuste, lo que impide recalcular el costo promedio de forma segura. Use un ajuste manual (EAI/SAJ) o una devolución a proveedor (DVC) en su lugar.`,
              );
            }

            const product = await tx.product.findUniqueOrThrow({
              where: { id: movement.productId },
            });

            const reversedAvgCost = await computeReversedAvgCost(
              tx,
              movement.productId,
              Number(product.avgCost),
              quantity,
              Number(movement.unitCost),
            );

            // lastCost solo se revierte para CM (EAI nunca lo toca, ni al
            // confirmar ni acá).
            const updateData: Prisma.ProductUpdateInput = {
              avgCost: reversedAvgCost,
            };

            if (document.type === DocumentType.CM) {
              const resolvedLastCost = await resolveLastCostAfterVoidingCm(
                tx,
                movement.productId,
                id,
                movement.createdAt,
              );
              if (resolvedLastCost !== undefined) {
                updateData.lastCost = resolvedLastCost;
              }
            }

            await tx.product.update({
              where: { id: movement.productId },
              data: updateData,
            });
          }

          // Si la reversión quita stock (quantity > 0: deshace una entrada —
          // CM, EAI, o el destino de un T) en bodega store, hay que frenarla si
          // pisa una reserva de PV — mismo chequeo que assertSufficientStock al
          // confirmar SAJ/DVC/T. Reversiones que devuelven stock nunca pisan una reserva.
          if (quantity > 0) {
            let warehouseType = warehouseTypeCache.get(movement.warehouseId);

            if (warehouseType === undefined) {
              const warehouse = await tx.warehouse.findUniqueOrThrow({
                where: { id: movement.warehouseId },
                select: { type: true },
              });
              warehouseType = warehouse.type;
              warehouseTypeCache.set(movement.warehouseId, warehouseType);
            }

            if (warehouseType === 'store') {
              const product = await tx.product.findUniqueOrThrow({
                where: { id: movement.productId },
                select: { code: true },
              });

              await assertAvailableForReservation(
                tx,
                movement.productId,
                movement.warehouseId,
                quantity,
                ({ available, reserved, requestedQty }) => {
                  const reservedNote =
                    reserved > 0
                      ? ` (${reserved} ya reservadas por preventas)`
                      : '';
                  return `No se puede anular: dejaría solo ${available} unidades disponibles de ${product.code}${reservedNote}, pero esta anulación movía ${requestedQty}.`;
                },
              );
            }
          }

          const { previousStock, newStock } = await applyStockChange(tx, {
            productId: movement.productId,
            warehouseId: movement.warehouseId,
            delta: -quantity,
          });

          // Solo los movimientos de traslado tienen binId; revertirlos también
          // a nivel de bulto es obligatorio para no romper SUM(BinStock)===Inventory.
          if (movement.binId) {
            await applyBinStockChange(tx, {
              productId: movement.productId,
              binId: movement.binId,
              warehouseId: movement.warehouseId,
              delta: -quantity,
            });
          }

          await tx.inventoryMovement.create({
            data: {
              productId: movement.productId,
              warehouseId: movement.warehouseId,
              binId: movement.binId,
              movementType: MovementType.void,
              quantity: -quantity,
              unitCost: movement.unitCost,
              previousStock,
              newStock,
              documentId: id,
              documentItemId: movement.documentItemId,
              userId: user.sub,
            },
          });
        }

        await tx.accountsPayable.deleteMany({ where: { documentId: id } });

        // Hard delete (mismo patrón que accountsPayable.deleteMany) — ya se
        // validó antes de la transacción que ningún crédito tiene aplicaciones.
        if (document.supplierCredits.length > 0) {
          await tx.supplierCredit.deleteMany({
            where: { sourceDocumentId: id },
          });
        }
      },
      { timeout: 30000 },
    );

    return this.findOne(id);
  }

  async duplicate(id: string, user: JwtPayload) {
    const source = await this.prisma.document.findUnique({
      where: { id },
      include: { documentItems: true },
    });

    if (!source) {
      throw new NotFoundException('Documento no encontrado');
    }

    this.assertDocumentPermission(user, source.type);

    if (source.type !== DocumentType.CM) {
      throw new BadRequestException('Solo se pueden duplicar compras (CM)');
    }

    // Mismo mecanismo que create(): revalida que los productos originales sigan
    // en una marca del proveedor (pudo cambiar desde que se creó el documento fuente).
    const strategy = this.effectsRegistry.get(DocumentType.CM);
    const validateCreateDto: CreateDocumentDto = {
      type: DocumentType.CM,
      date: new Date().toISOString(),
      thirdPartyId: source.thirdPartyId ?? undefined,
      items: source.documentItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };
    await strategy.validateCreate?.(validateCreateDto);

    const document = await this.prisma.$transaction(async (tx) => {
      const consecutive = await this.nextNumber(tx, DocumentType.CM);

      const items = source.documentItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: Number(item.unitCost),
        unitPrice: Number(item.unitPrice),
        observaciones: item.observaciones ?? undefined,
      }));

      const document = await tx.document.create({
        data: {
          type: DocumentType.CM,
          number: consecutive,
          status: DocumentStatus.draft,
          date: new Date(),
          userId: user.sub,
          // A diferencia de create(), NO se re-resuelve la tienda activa acá —
          // se copia la del original. Decisión de alcance: si la tienda activa
          // cambió, el duplicado queda apuntando a la bodega vieja (aceptado en v1).
          warehouseId: source.warehouseId,
          thirdPartyId: source.thirdPartyId,
          notes: source.notes,
          documentItems: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              unitPrice: item.unitPrice,
              observaciones: item.observaciones ?? null,
              subtotal: this.computeItemSubtotal(item, DocumentType.CM),
            })),
          },
          total: this.computeTotal(items, DocumentType.CM),
        },
        include: DETAIL_INCLUDE,
      });

      return document;
    });

    return document;
  }

  /**
   * Convierte una PV confirmada en un documento de venta real (hoy solo POS).
   * Solo toma líneas con reserva pendiente (quantity - releasedQuantity -
   * convertedQuantity > 0) — el consumo real se aplica al confirmar el
   * documento derivado (PvEffectStrategy.consumeForConversion), no acá.
   */
  async convert(sourceId: string, dto: ConvertDocumentDto, user: JwtPayload) {
    const source = await this.prisma.document.findUnique({
      where: { id: sourceId },
      include: { documentItems: { include: { product: true } } },
    });

    if (!source) {
      throw new NotFoundException('Documento no encontrado');
    }

    if (
      source.type !== DocumentType.PV ||
      source.status !== DocumentStatus.confirmed
    ) {
      throw new BadRequestException(
        'Solo se pueden convertir preventas confirmadas',
      );
    }

    this.assertDocumentPermission(user, DocumentType.PV, 'convert');

    if (dto.targetType !== DocumentType.POS) {
      throw new BadRequestException(
        `Conversión a ${dto.targetType} no soportada todavía`,
      );
    }

    const pendingItems = source.documentItems
      .map((item) => ({
        item,
        pending: item.quantity - item.releasedQuantity - item.convertedQuantity,
      }))
      .filter(({ pending }) => pending > 0);

    if (pendingItems.length === 0) {
      throw new BadRequestException(
        'La preventa ya fue completamente convertida o liberada',
      );
    }

    const validateCreateDto: CreateDocumentDto = {
      type: DocumentType.POS,
      date: new Date().toISOString(),
      thirdPartyId: source.thirdPartyId ?? undefined,
      sellerId: source.sellerId ?? undefined,
      paymentMethod: dto.paymentMethod,
      items: pendingItems.map(({ item, pending }) => ({
        productId: item.productId,
        quantity: pending,
        unitPrice: Number(item.unitPrice),
      })),
    };

    // Mismo mecanismo que duplicate(): revalida antes de crear el borrador.
    // Si minSalePrice subió desde que se creó la PV, esto puede rechazar la
    // conversión — comportamiento correcto (sin auto-ajuste de precio en v1).
    const posStrategy = this.effectsRegistry.get(DocumentType.POS);
    await posStrategy.validateCreate?.(validateCreateDto);

    const store = await this.prisma.warehouse.findFirst({
      where: { type: 'store', active: true },
    });
    if (!store) {
      throw new BadRequestException(
        'No existe una tienda activa para asignar al documento',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const number = await this.nextNumber(tx, DocumentType.POS);
      const total = this.computeTotal(validateCreateDto.items, DocumentType.POS);

      return tx.document.create({
        data: {
          type: DocumentType.POS,
          number,
          date: new Date(),
          thirdPartyId: source.thirdPartyId,
          sellerId: source.sellerId,
          userId: user.sub,
          status: DocumentStatus.draft,
          total,
          warehouseId: store.id,
          paymentMethod: dto.paymentMethod,
          sourceDocumentId: source.id,
          documentItems: {
            create: validateCreateDto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice ?? 0,
              subtotal: this.computeItemSubtotal(item, DocumentType.POS),
            })),
          },
        },
        include: DETAIL_INCLUDE,
      });
    });
  }

  async remove(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({ where: { id } });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    this.assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.draft) {
      throw new ConflictException(
        'Solo se pueden eliminar documentos en borrador',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.documentItem.deleteMany({ where: { documentId: id } });
      return tx.document.delete({ where: { id } });
    });
  }

  /**
   * Libera (parcial o totalmente) la reserva pendiente de una o más líneas
   * de un documento confirmado. Solo tipos con estrategia de reserva
   * (hoy solo PV) exponen esto — getReservation lanza si el tipo no aplica.
   */
  async releaseItems(
    id: string,
    releaseItemsDto: ReleaseItemsDto,
    user: JwtPayload,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: { include: { product: true } },
        thirdParty: { include: { supplier: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    this.assertDocumentPermission(user, document.type, 'release');

    if (document.status !== DocumentStatus.confirmed) {
      throw new ConflictException(
        'Solo se pueden liberar reservas de documentos confirmados',
      );
    }

    const strategy = this.effectsRegistry.getReservation(document.type);

    await this.prisma.$transaction(async (tx) => {
      await strategy.releaseItems(
        tx,
        document,
        releaseItemsDto.items,
        user.sub,
        releaseItemsDto.notes,
      );
    });

    return this.findOne(id);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  // action distingue el permiso: document.create.{type} cubre todo el ciclo
  // "estándar" (create/update/confirm/void/remove); document.release.{type} es
  // aparte porque liberar una reserva de PV puede recaer en un rol distinto.
  private assertDocumentPermission(
    user: JwtPayload,
    type: DocumentType,
    action: 'create' | 'release' | 'convert' = 'create',
  ) {
    if (!user.permissions.includes(`document.${action}.${type}`)) {
      const actionLabel =
        action === 'release'
          ? 'liberar reservas de'
          : action === 'convert'
            ? 'convertir preventas de'
            : 'crear';
      throw new ForbiddenException(
        `No tiene permiso para ${actionLabel} documentos de tipo ${type}`,
      );
    }
  }

  /**
   * PV/POS se valoran a precio de venta (unitPrice), el resto (CM/DVC/EAI/SAJ/T)
   * sobre unitCost. Un Set de tipos "price-based" evita un switch/if disperso
   * cuando un tipo nuevo (ej. COT) también se valore a precio.
   */
  private static readonly PRICE_BASED_TYPES = new Set<DocumentType>([
    DocumentType.PV,
    DocumentType.POS,
  ]);

  private computeItemSubtotal(item: CreateDocumentItemDto, type: DocumentType) {
    const usePrice = DocumentsService.PRICE_BASED_TYPES.has(type);
    return (
      item.quantity * (usePrice ? (item.unitPrice ?? 0) : (item.unitCost ?? 0))
    );
  }

  private computeTotal(items: CreateDocumentItemDto[], type: DocumentType) {
    return items.reduce(
      (sum, item) => sum + this.computeItemSubtotal(item, type),
      0,
    );
  }

  private async nextNumber(tx: Prisma.TransactionClient, type: DocumentType) {
    // El zero-padding a 6 dígitos hace que el orden lexicográfico funcione.
    const previous = await tx.document.findFirst({
      where: { type },
      orderBy: { number: 'desc' },
    });

    return String(parseInt(previous?.number ?? '0', 10) + 1).padStart(6, '0');
  }
}
