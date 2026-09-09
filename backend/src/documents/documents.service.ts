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
import {
  assertAvailableForReservation,
  RESERVATION_TYPES,
} from './helpers/reservation.helpers';
import {
  applyBinStockChange,
  applyStockChange,
  computeReversedAvgCost,
  resolveLastCostAfterVoidingCm,
} from './helpers/stock.helpers';
import { matchItemsByProduct } from './helpers/conversion.helpers';
import { getCustomerCreditSummary } from './helpers/credit.helpers';
import { buildPvStatus, PvStatusInput } from './helpers/pv-status.helper';
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
  // Traemos las marcas del proveedor para que, al editar una compra o devolución,
  // el buscador y el escaneo de productos ya funcionen (sin esto quedan bloqueados).
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
  updatedBy: { select: { id: true, name: true } },
  convertedBy: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  destWarehouse: { select: { id: true, name: true } },
  destBin: { include: { zone: { select: { name: true } } } },
  sourceDocument: { select: { id: true, type: true, number: true } },
  derivedDocuments: {
    select: { id: true, type: true, number: true, status: true },
  },
} satisfies Prisma.DocumentInclude;

// Datos recortados para el PDF: solo lo que muestra la impresión de compras y
// devoluciones. No trae el costo promedio del producto a propósito: el PDF usa
// el costo real de cada línea, y mezclarlo con el promedio actual daría cifras mal.
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

  /**
   * Tipos de documento que el rol puede ver en el listado. Se derivan de los
   * permisos document.create.{TIPO} del usuario — no existe un document.read.{TIPO}
   * aparte. El gate grueso sigue siendo @Permissions('document.read').
   */
  private visibleDocumentTypes(permissions: string[]): DocumentType[] {
    const prefix = 'document.create.';
    const valid = new Set<string>(Object.values(DocumentType));
    return permissions
      .filter((p) => p.startsWith(prefix))
      .map((p) => p.slice(prefix.length))
      .filter((t): t is DocumentType => valid.has(t));
  }

  async findAll(findAllDocumentsDto: FindAllDocumentsDto, user: JwtPayload) {
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

    const requestedTypes = typeList?.length
      ? typeList
      : type
        ? [type]
        : undefined;
    const allowedTypes = this.visibleDocumentTypes(user.permissions);
    // Si el cliente pide tipos, se intersecan con los visibles del rol; si no
    // pide nada, se limita a los visibles. Intersección vacía deja la lista
    // vacía, nunca un 403: pedir un tipo fuera del alcance del rol simplemente
    // devuelve la lista filtrada en silencio.
    const effectiveTypes = requestedTypes
      ? requestedTypes.filter((t) => allowedTypes.includes(t))
      : allowedTypes;

    const where: Prisma.DocumentWhereInput = {
      type: { in: effectiveTypes },
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
            derivedDocuments: {
              select: { id: true, type: true, number: true, status: true },
            },
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
      items: items.map((doc) => this.withPvStatus(doc)),
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

    return this.withPvStatus(document);
  }

  /** Datos mínimos para el PDF. Solo documentos confirmados: un borrador todavía puede cambiar y un PDF de algo no definitivo confunde. */
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

  /** Cupo de crédito del cliente: límite, usado y disponible, en pesos. Lo usa la pantalla de venta a crédito. */
  getCustomerCreditSummary(customerId: string) {
    return getCustomerCreditSummary(this.prisma, customerId);
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

    // Falla si el tipo de documento todavía no está implementado.
    const strategy = this.effectsRegistry.get(type);

    await strategy.validateCreate?.(createDocumentDto);

    let warehouseId: string | undefined;

    // Solo el traslado mueve stock entre bodegas que elige el usuario; el resto
    // siempre opera sobre la tienda activa, y la bodega no se recibe desde afuera.
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

    return this.withPvStatus(document);
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

    // Al editar un borrador no se vuelven a correr las validaciones de creación.
    // Por eso la confirmación del traslado revalida bulto y bodega desde cero.
    const updated = await this.prisma.$transaction(async (tx) => {
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
          updatedById: user.sub,
          ...(date && { date: new Date(date) }),
          ...(items && { total: this.computeTotal(items, document.type) }),
        },
        include: DETAIL_INCLUDE,
      });
    });

    return this.withPvStatus(updated);
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
        // Si otro proceso ya confirmó o anuló el documento, no aplicar efectos.
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

        // Si este documento nació de convertir una preventa o remisión, descuenta
        // lo vendido de la reserva original en la misma transacción (todo o nada).
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
   * Anular es genérico para todos los tipos: revierte los movimientos de
   * inventario registrados y borra las cuentas por pagar y por cobrar del
   * documento. Si algún tipo futuro necesita una reversa propia, se agrega ahí.
   */
  async void(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: { select: { id: true, productId: true, quantity: true } },
        derivedDocuments: { select: { id: true, status: true } },
        inventoryMovements: {
          include: { documentItem: { select: { unitCost: true } } },
        },
        accountsPayable: {
          include: { payablePayments: true, creditApplications: true },
        },
        accountsReceivable: { include: { receivablePayments: true } },
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

    // Una preventa o remisión ya convertida en venta no se puede anular: la venta
    // derivada quedaría consumiendo una reserva que la anulación ya liberó.
    // Primero hay que anular esa venta.
    if (
      RESERVATION_TYPES.includes(document.type) &&
      document.derivedDocuments.some(
        (d) => d.status !== DocumentStatus.voided,
      )
    ) {
      throw new ConflictException(
        'No se puede anular: este documento fue convertido a una venta. Anule primero el documento de venta derivado.',
      );
    }

    // Un pago puede saldarse 100% con nota crédito y no dejar fila de pago.
    // Si no se miran también las notas crédito aplicadas, ese caso no frena la
    // anulación y más abajo revienta con un error crudo de base de datos.
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

    // Si la nota crédito que generó esta devolución ya se aplicó a otra cuenta
    // por pagar, anular el documento la dejaría suelta pero todavía usable.
    const hasCreditApplications = document.supplierCredits.some(
      (credit) => credit.applications.length > 0,
    );

    if (hasCreditApplications) {
      throw new ConflictException(
        'No se puede anular: la nota crédito generada por este documento ya fue aplicada a un pago',
      );
    }

    // La venta a crédito genera una cuenta por cobrar; si ya recibió pagos no se
    // puede anular (quedarían sueltos). Mismo criterio que la cuenta por pagar de arriba.
    const hasReceivablePayments = document.accountsReceivable.some(
      (receivable) => receivable.receivablePayments.length > 0,
    );

    if (hasReceivablePayments) {
      throw new ConflictException(
        'No se puede anular: la cuenta por cobrar ya tiene pagos registrados',
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

        // En preventas y remisiones, anular libera toda la reserva de una vez.
        // Ese caso no dejaba rastro; este bloque anota la liberación igual que
        // cuando se libera manualmente.
        const strategy = this.effectsRegistry.get(document.type);
        if (isReservationStrategy(strategy)) {
          // Se vuelven a leer las líneas dentro de la transacción: si alguien
          // liberó reservas justo antes, el dato de afuera estaría viejo y este
          // bloque liberaría de más.
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

        // Si nació de convertir una preventa o remisión, hay que devolverle las
        // unidades marcadas como convertidas; si no, quedarían así para siempre y
        // esa reserva nunca volvería a estar disponible.
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

        // El costo promedio solo se revierte en compras y ajustes de entrada
        // (los únicos que lo recalculan al confirmar) y solo si el movimiento a
        // anular es el último del producto.
        // Se cachea por producto: un documento con varias líneas del mismo
        // producto repetiría la misma consulta. Es seguro cachear porque la
        // consulta excluye el documento que se está anulando.
        const recentConsumptionCache = new Map<
          string,
          Awaited<ReturnType<typeof tx.inventoryMovement.findFirst>>
        >();

        // Se cachea por bodega: las líneas de un mismo documento casi siempre
        // comparten bodega, así no se repite la consulta del tipo de bodega.
        const warehouseTypeCache = new Map<string, string>();

        for (const movement of document.inventoryMovements) {
          const quantity = movement.quantity;
          const isCostAffecting =
            document.type === DocumentType.CM ||
            (document.type === DocumentType.EAI &&
              Number(movement.documentItem?.unitCost ?? 0) > 0);

          if (isCostAffecting) {
            // Las líneas del mismo documento se excluyen del chequeo comparando
            // la fecha de creación (no el id, para no depender del orden del
            // bucle). Solo cuenta el consumo real (salidas): un traslado no,
            // porque su neto es cero; una anulación tampoco, porque revertir una
            // compra o ajuste previo no es consumo. Sin esto, anular dos compras
            // seguidas del mismo producto fallaba sin motivo.
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

            // El último costo solo se revierte en compras; los ajustes de entrada
            // nunca lo tocan.
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

          // Si al revertir se quita stock (se deshace una entrada) en la tienda,
          // hay que frenar la anulación cuando pisaría una reserva de preventa.
          // Las reversiones que devuelven stock nunca pisan una reserva.
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

          // Solo los traslados tienen bulto asignado; al revertirlos hay que
          // ajustar también el stock del bulto para no descuadrar el inventario.
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
        await tx.accountsReceivable.deleteMany({ where: { documentId: id } });

        // Borrado definitivo: antes de la transacción ya se verificó que ninguna
        // nota crédito tiene aplicaciones.
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

    // Igual que al crear: revalida que los productos sigan perteneciendo a una
    // marca del proveedor (pudo cambiar desde que se creó el documento original).
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
          // Acá no se recalcula la tienda activa: se copia la del original. Si la
          // tienda activa cambió, el duplicado apunta a la bodega vieja (aceptado por ahora).
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

    return this.withPvStatus(document);
  }

  /**
   * Convierte una preventa o remisión confirmada en una venta real (de contado o
   * a crédito). Solo toma las líneas con reserva pendiente; el descuento real de
   * la reserva ocurre al confirmar la venta derivada, no acá.
   */
  async convert(sourceId: string, dto: ConvertDocumentDto, user: JwtPayload) {
    const source = await this.prisma.document.findUnique({
      where: { id: sourceId },
      include: {
        documentItems: { include: { product: true } },
        derivedDocuments: { select: { id: true, status: true } },
      },
    });

    if (!source) {
      throw new NotFoundException('Documento no encontrado');
    }

    if (
      !RESERVATION_TYPES.includes(source.type) ||
      source.status !== DocumentStatus.confirmed
    ) {
      throw new BadRequestException(
        'Solo se pueden convertir preventas o remisiones confirmadas',
      );
    }

    // El permiso depende del tipo de origen: convertir preventas o convertir remisiones.
    this.assertDocumentPermission(user, source.type, 'convert');

    // Confirmar la venta derivada ya exige su propio permiso de creación; acá
    // solo se restringe a los tipos de venta que admiten conversión.
    if (
      dto.targetType !== DocumentType.POS &&
      dto.targetType !== DocumentType.COT
    ) {
      throw new BadRequestException(
        `Conversión a ${dto.targetType} no soportada`,
      );
    }

    // Por ahora solo se permite conversión total: cada preventa o remisión tiene
    // como mucho una venta derivada activa. Sin esto, una segunda conversión deja
    // un borrador que nunca se podrá confirmar.
    if (source.derivedDocuments.some((d) => d.status !== DocumentStatus.voided)) {
      throw new ConflictException(
        'Este documento ya tiene una venta derivada activa. Anúlela antes de convertir de nuevo.',
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
        'El documento ya fue completamente convertido o liberado',
      );
    }

    // La venta a crédito no lleva forma de pago; la de contado conserva la recibida.
    const paymentMethod =
      dto.targetType === DocumentType.COT ? undefined : dto.paymentMethod;

    const validateCreateDto: CreateDocumentDto = {
      type: dto.targetType,
      date: new Date().toISOString(),
      thirdPartyId: source.thirdPartyId ?? undefined,
      sellerId: source.sellerId ?? undefined,
      paymentMethod,
      items: pendingItems.map(({ item, pending }) => ({
        productId: item.productId,
        quantity: pending,
        unitPrice: Number(item.unitPrice),
      })),
    };

    // Igual que al duplicar: revalida antes de crear el borrador, corriendo las
    // reglas del tipo destino. Así la venta a crédito verifica el cupo del cliente
    // en el momento de convertir. Si el precio mínimo subió desde que se creó la
    // preventa, la conversión puede rechazarse; es lo esperado.
    const targetStrategy = this.effectsRegistry.get(dto.targetType);
    await targetStrategy.validateCreate?.(validateCreateDto);

    const store = await this.prisma.warehouse.findFirst({
      where: { type: 'store', active: true },
    });
    if (!store) {
      throw new BadRequestException(
        'No existe una tienda activa para asignar al documento',
      );
    }

    const derived = await this.prisma.$transaction(async (tx) => {
      const number = await this.nextNumber(tx, dto.targetType);
      const total = this.computeTotal(validateCreateDto.items, dto.targetType);

      const created = await tx.document.create({
        data: {
          type: dto.targetType,
          number,
          date: new Date(),
          thirdPartyId: source.thirdPartyId,
          sellerId: source.sellerId,
          userId: user.sub,
          status: DocumentStatus.draft,
          total,
          warehouseId: store.id,
          paymentMethod: paymentMethod ?? null,
          sourceDocumentId: source.id,
          documentItems: {
            create: validateCreateDto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice ?? 0,
              subtotal: this.computeItemSubtotal(item, dto.targetType),
            })),
          },
        },
        include: DETAIL_INCLUDE,
      });

      // Deja registrado en el origen quién y cuándo lo convirtió. El descuento
      // real de la reserva ocurre al confirmar la venta derivada.
      await tx.document.update({
        where: { id: source.id },
        data: { convertedById: user.sub, convertedAt: new Date() },
      });

      return created;
    });

    // La respuesta es la venta derivada, así que el bloque de conversión sale
    // vacío; se mantiene la misma forma que el resto de las lecturas.
    return this.withPvStatus(derived);
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
   * Libera, total o parcialmente, la reserva pendiente de una o más líneas de un
   * documento confirmado. Solo aplica a preventas y remisiones; para otros tipos falla.
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

  // Agrega el bloque con el estado de conversión. La clave se sigue llamando `pv`
  // por historia (para no romper el frontend), aunque hoy también aplica a las
  // remisiones. Va vacío para el resto de tipos. Se calcula en cada lectura, no
  // se guarda. Se quitan los documentos derivados de la respuesta: son la fuente
  // de ese bloque y repetirlos sería dato duplicado en cada fila.
  private withPvStatus<T extends PvStatusInput>(doc: T) {
    const { derivedDocuments: _derivedDocuments, ...rest } = doc;
    return { ...rest, pv: buildPvStatus(doc) };
  }

  // El parámetro `action` elige el permiso: el de crear cubre el ciclo normal
  // (crear, editar, confirmar, anular, eliminar); liberar una reserva tiene
  // permiso propio porque puede recaer en otro rol.
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
            ? 'convertir'
            : 'crear';
      throw new ForbiddenException(
        `No tiene permiso para ${actionLabel} documentos de tipo ${type}`,
      );
    }
  }

  /**
   * Preventas, remisiones y ventas se valoran al precio de venta; el resto de
   * los documentos, al costo. Tener la lista en un Set evita repartir condicionales
   * por todo el código cuando se agregue otro tipo valorado a precio.
   */
  private static readonly PRICE_BASED_TYPES = new Set<DocumentType>([
    DocumentType.PV,
    DocumentType.REM,
    DocumentType.POS,
    DocumentType.COT,
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
    // Se rellena con ceros a 6 dígitos para que ordenar como texto dé el orden correcto.
    const previous = await tx.document.findFirst({
      where: { type },
      orderBy: { number: 'desc' },
    });

    return String(parseInt(previous?.number ?? '0', 10) + 1).padStart(6, '0');
  }
}
