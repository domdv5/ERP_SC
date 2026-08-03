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
  CreateDocumentDto,
  CreateDocumentItemDto,
  FindAllDocumentsDto,
  ReleaseItemsDto,
  UpdateDocumentDto,
} from './dto/index';
import {
  applyBinStockChange,
  applyStockChange,
  computeReversedAvgCost,
  resolveLastCostAfterVoidingCm,
} from './helpers/stock.helpers';
import { DocumentEffectsRegistry } from './strategies/index';

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
  thirdParty: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
  confirmedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
  warehouse: { select: { id: true, name: true } },
  destWarehouse: { select: { id: true, name: true } },
  destBin: { include: { zone: { select: { name: true } } } },
  sourceDocument: { select: { id: true, type: true, number: true } },
} satisfies Prisma.DocumentInclude;

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
      freight,
      notes,
      ...rest
    } = createDocumentDto;

    this.assertDocumentPermission(user, type);

    // Lanza BadRequestException si el tipo aún no tiene estrategia (fase 2).
    const strategy = this.effectsRegistry.get(type);

    await strategy.validateCreate?.(createDocumentDto);

    let warehouseId: string | undefined;

    // Solo el traslado (T) mueve stock entre dos bodegas elegidas por el
    // usuario; el resto de tipos siempre opera sobre la única tienda activa,
    // así que el cliente nunca envía warehouseId salvo para T.
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
          freight,
          notes,
          warehouseId,
          destWarehouseId,
          destBinId,
          sourceBinId,
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

    // A diferencia de create(), acá NO se corre strategy.validateCreate: un
    // borrador se puede editar (ej. cambiar bulto/bodega de un traslado) sin
    // volver a pasar por esa validación. Por eso TransferEffectStrategy.confirm
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

        // avgCost solo se reversa para CM/EAI (únicos tipos que lo re-ponderan
        // al confirmar) y solo cuando el movimiento a anular es el más
        // reciente de ese producto — ver computeReversedAvgCost para el
        // porqué de esa condición.
        // Memoizada por productId: un CM/EAI con varias líneas del mismo
        // producto repetiría exactamente la misma query — es segura de
        // cachear porque filtra documentId: { not: id }, y nada que este
        // loop mute (movimientos nuevos de tipo void, avgCost) afecta ese
        // resultado.
        const recentConsumptionCache = new Map<
          string,
          Awaited<ReturnType<typeof tx.inventoryMovement.findFirst>>
        >();

        for (const movement of document.inventoryMovements) {
          const quantity = movement.quantity;
          const isCostAffecting =
            document.type === DocumentType.CM ||
            (document.type === DocumentType.EAI &&
              Number(movement.documentItem?.unitCost ?? 0) > 0);

          if (isCostAffecting) {
            // Un CM/EAI puede tener varias líneas del mismo producto (Plan 004
            // no las prohíbe). Todas comparten documentId con este documento
            // — se excluyen del chequeo de recencia (son parte del mismo lote
            // que se está anulando, no consumo externo) comparando createdAt
            // en vez de solo el id, para no depender del orden de iteración.
            // Solo bloquea consumo real de stock (quantity < 0, ej. DVC/SAJ):
            // otra compra/EAI posterior no rompe la reversión (la ponderación
            // de adiciones puras es asociativa) y un traslado (T) tampoco,
            // porque su neto sobre el stock global del producto es cero.
            // Tampoco un void: un void que reversa una compra/EAI anterior
            // tiene quantity negativa pero no es consumo real (mismo
            // argumento de asociatividad de arriba, extendido a voids de
            // compras anteriores) — sin excluirlo, anular CM1 y luego CM2
            // del mismo producto fallaba aunque debería poder anularse.
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

          const { previousStock, newStock } = await applyStockChange(tx, {
            productId: movement.productId,
            warehouseId: movement.warehouseId,
            delta: -quantity,
          });

          // Solo los movimientos de traslado tienen binId (ver BinStock
          // population en el módulo); revertirlos también a nivel de bulto
          // es obligatorio para no romper SUM(BinStock)===Inventory.
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

        // Hard delete, mismo patrón que accountsPayable.deleteMany arriba —
        // ya se validó antes de entrar a la transacción que ningún crédito
        // tiene aplicaciones (hasCreditApplications).
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

  // action distingue el permiso a chequear: document.create.{type} cubre
  // create/update/confirm/void/remove (todo el ciclo de vida "estándar"),
  // document.release.{type} es aparte porque liberar una reserva de PV es
  // una operación que puede recaer en un rol distinto (ej. bodega/ventas)
  // del que crea/confirma la preventa.
  private assertDocumentPermission(
    user: JwtPayload,
    type: DocumentType,
    action: 'create' | 'release' = 'create',
  ) {
    if (!user.permissions.includes(`document.${action}.${type}`)) {
      const actionLabel =
        action === 'release' ? 'liberar reservas de' : 'crear';
      throw new ForbiddenException(
        `No tiene permiso para ${actionLabel} documentos de tipo ${type}`,
      );
    }
  }

  /**
   * PV se valora a precio de venta (unitPrice), no a costo — el resto de
   * tipos (CM/DVC/EAI/SAJ/T) siguen calculando sobre unitCost exactamente
   * igual que antes. Un Set de tipos "price-based" evita un switch/if
   * disperso si en fase 2 aparece otro tipo valorado a precio (COT/POS).
   */
  private static readonly PRICE_BASED_TYPES = new Set<DocumentType>([
    DocumentType.PV,
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
