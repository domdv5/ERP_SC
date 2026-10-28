import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DocumentStatus, DocumentType, MovementType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { SequenceService } from '@/common/sequence/sequence.service';
import { todayInBogota } from '@/common/utils/date-range.util';
import {
  ConfirmDocumentDto,
  CreateDocumentDto,
  ReleaseItemsDto,
  UpdateDocumentDto,
} from './dto/index';
import { undoCustomerCreditApplications } from './helpers/customer-credit.helpers';
import {
  assertAvailableForReservation,
  RESERVATION_TYPES,
} from './helpers/reservation.helpers';
import {
  applyBinStockChange,
  applyStockChange,
  calculateAvgCostAfterVoid,
  findLastPurchaseCostAfterVoid,
} from './helpers/stock.helpers';
import { matchItemsByProduct } from './helpers/conversion.helpers';
import {
  DUPLICATE_REQUEST_MESSAGE,
  isIdempotencyKeyConflict,
  isSameDocumentRequest,
} from './helpers/idempotency.helpers';
import {
  assertOfficialFieldsAllowed,
  computeAmounts,
} from './helpers/document-amounts';
import {
  assertDocumentPermission,
  lockDocumentStatus,
} from './helpers/document-guards.helpers';
import { withPvStatus } from './helpers/pv-status.helper';
import {
  DETAIL_INCLUDE,
  DocumentsQueryService,
} from './documents-query.service';
import { resolveDocumentDate } from './helpers/document-date.helper';
import {
  DocumentEffectsRegistry,
  isReservationStrategy,
} from './strategies/index';

// Anular ventas es autoridad de cuentas (document.void.{TIPO}), no de quien las crea.
const SALE_VOID_TYPES: ReadonlySet<DocumentType> = new Set([
  DocumentType.POS,
  DocumentType.COT,
  DocumentType.POSO,
  DocumentType.REM,
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectsRegistry: DocumentEffectsRegistry,
    private readonly sequenceService: SequenceService,
    private readonly documentsQuery: DocumentsQueryService,
  ) {}

  async create(createDocumentDto: CreateDocumentDto, user: JwtPayload) {
    const {
      type,
      date,
      items,
      thirdPartyId,
      sellerId,
      receiverId,
      customerBranchId,
      destWarehouseId,
      destBinId,
      sourceBinId,
      notes,
      adjustmentReason,
      adjustmentReasonOther,
      payments,
      refundMethod,
      officialPurchase,
      supplierInvoiceNumber,
      sourceDocumentId,
      idempotencyKey,
      ...rest
    } = createDocumentDto;

    assertDocumentPermission(user, type);
    assertOfficialFieldsAllowed(type, {
      officialPurchase,
      supplierInvoiceNumber,
      sourceDocumentId,
    });

    if (idempotencyKey) {
      const alreadyCreated = await this.findByIdempotencyKey(
        idempotencyKey,
        createDocumentDto,
        user,
      );
      if (alreadyCreated) return alreadyCreated;
    }

    // Falla si el tipo de documento todavía no está implementado.
    const strategy = this.effectsRegistry.get(type);
    const now = new Date();

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

    const createInTransaction = () =>
      this.prisma.$transaction(async (tx) => {
        const number = await this.nextNumber(tx, type);
        const amounts = computeAmounts(items, type);

        return tx.document.create({
          data: {
            type,
            number,
            date: resolveDocumentDate(strategy.usesTodayDate, date),
            thirdPartyId,
            sellerId,
            receiverId: type === DocumentType.CM ? receiverId : undefined,
            customerBranchId: strategy.tracksCustomerBranch
              ? (customerBranchId ?? null)
              : null,
            userId: user.sub,
            status: DocumentStatus.draft,
            total: amounts.total,
            taxTotal: amounts.taxTotal,
            notes,
            warehouseId,
            destWarehouseId,
            destBinId,
            sourceBinId,
            adjustmentReason,
            adjustmentReasonOther,
            refundMethod: refundMethod ?? null,
            officialPurchase: officialPurchase ?? false,
            supplierInvoiceNumber: supplierInvoiceNumber?.trim() || null,
            sourceDocumentId: sourceDocumentId ?? null,
            idempotencyKey: idempotencyKey ?? null,
            ...(payments && {
              payments: { create: payments },
            }),
            documentItems: {
              create: items.map((item, index) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitCost: item.unitCost ?? 0,
                unitPrice: item.unitPrice ?? 0,
                subtotal: amounts.lines[index].subtotal,
                taxAmount: amounts.lines[index].taxAmount,
                observaciones: item.observaciones ?? null,
                addedAt: strategy.resolveItemAddedAt(item.addedAt, now),
              })),
            },
          },
          include: DETAIL_INCLUDE,
        });
      });

    let document: Awaited<ReturnType<typeof createInTransaction>>;
    try {
      document = await createInTransaction();
    } catch (error) {
      // Carrera real entre dos pedidos con la misma clave: el @unique revienta con P2002 después de que ambos pasaron la búsqueda.
      if (idempotencyKey && isIdempotencyKeyConflict(error)) {
        const winner = await this.findByIdempotencyKey(
          idempotencyKey,
          createDocumentDto,
          user,
        );
        if (winner) return winner;
      }
      throw error;
    }

    return withPvStatus(document);
  }

  private async findByIdempotencyKey(
    idempotencyKey: string,
    dto: CreateDocumentDto,
    user: JwtPayload,
  ) {
    const existing = await this.prisma.document.findUnique({
      where: { idempotencyKey },
      include: DETAIL_INCLUDE,
    });
    if (!existing) return null;
    const strategy = this.effectsRegistry.get(dto.type);
    if (!isSameDocumentRequest(dto, existing, user.sub, strategy)) {
      throw new ConflictException(DUPLICATE_REQUEST_MESSAGE);
    }
    return withPvStatus(existing);
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

    assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.draft) {
      throw new ConflictException(
        'Solo se pueden editar documentos en borrador',
      );
    }

    // customerCredits no es columna de Document (solo lo usa la venta a crédito
    // para netear el cupo al validar); se descarta antes de tocar la fila.
    const {
      items,
      date,
      customerCredits: _customerCredits,
      payments,
      supplierInvoiceNumber,
      receiverId,
      customerBranchId,
      ...rest
    } = updateDocumentDto;

    assertOfficialFieldsAllowed(document.type, {
      officialPurchase: rest.officialPurchase,
      supplierInvoiceNumber,
      sourceDocumentId: rest.sourceDocumentId,
    });
    const amounts = items && computeAmounts(items, document.type);
    const strategy = this.effectsRegistry.get(document.type);
    const newDate = resolveDocumentDate(strategy.usesTodayDate, date);
    const now = new Date();

    // Al editar un borrador no se vuelven a correr las validaciones de creación.
    // Por eso la confirmación del traslado revalida bulto y bodega desde cero.
    const updated = await this.prisma.$transaction(async (tx) => {
      if (items && amounts) {
        await tx.documentItem.deleteMany({ where: { documentId: id } });
        await tx.documentItem.createMany({
          data: items.map((item, index) => ({
            documentId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost ?? 0,
            unitPrice: item.unitPrice ?? 0,
            subtotal: amounts.lines[index].subtotal,
            taxAmount: amounts.lines[index].taxAmount,
            observaciones: item.observaciones ?? null,
            addedAt: strategy.resolveItemAddedAt(item.addedAt, now),
          })),
        });
      }

      if (payments) {
        await tx.documentPayment.deleteMany({ where: { documentId: id } });
        await tx.documentPayment.createMany({
          data: payments.map((payment) => ({ documentId: id, ...payment })),
        });
      }

      return tx.document.update({
        where: { id },
        data: {
          ...rest,
          ...(document.type === DocumentType.CM &&
            receiverId !== undefined && { receiverId }),
          ...(strategy.tracksCustomerBranch &&
            customerBranchId !== undefined && { customerBranchId }),
          updatedById: user.sub,
          editedAt: now,
          ...(newDate && { date: newDate }),
          ...(supplierInvoiceNumber !== undefined && {
            supplierInvoiceNumber: supplierInvoiceNumber.trim() || null,
          }),
          ...(amounts && {
            total: amounts.total,
            taxTotal: amounts.taxTotal,
          }),
        },
        include: DETAIL_INCLUDE,
      });
    });

    return withPvStatus(updated);
  }

  /** Faltantes de stock de un borrador, con la misma regla que usa confirm(); [] si el tipo no valida stock. */
  async findMissingStock(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: { include: { product: true } },
        payments: true,
        thirdParty: { include: { supplier: true, customer: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    assertDocumentPermission(user, document.type);

    if (
      document.status !== DocumentStatus.draft ||
      document.documentItems.length === 0 ||
      !document.warehouseId
    ) {
      return [];
    }

    const strategy = this.effectsRegistry.get(document.type);
    if (!strategy.findMissingStock) return [];

    // Sin $transaction: el FOR UPDATE se libera al instante en autocommit y una lectura nunca retiene locks de inventario.
    return strategy.findMissingStock(this.prisma, document);
  }

  async confirm(
    id: string,
    dto: ConfirmDocumentDto | undefined,
    user: JwtPayload,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: { include: { product: true } },
        payments: true,
        thirdParty: { include: { supplier: true, customer: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    assertDocumentPermission(user, document.type);

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
          data: {
            status: DocumentStatus.confirmed,
            confirmedById: user.sub,
            confirmedAt: new Date(),
            ...(this.effectsRegistry.get(document.type).usesTodayDate && {
              date: todayInBogota(),
            }),
          },
        });

        if (claimed.count === 0) {
          throw new ConflictException(
            'Solo se pueden confirmar documentos en borrador',
          );
        }

        // context lleva los saldos a favor del cliente citados en el body; solo
        // los usan POS/COT, el resto de estrategias lo ignora.
        await this.effectsRegistry
          .get(document.type)
          .confirm(tx, document, user.sub, {
            appliedCustomerCredits: dto?.customerCredits,
          });

        // Si este documento nació de convertir una preventa o remisión, descuenta
        // lo vendido de la reserva original en la misma transacción (todo o nada).
        if (document.sourceDocumentId) {
          const source = await tx.document.findUnique({
            where: { id: document.sourceDocumentId },
            include: {
              documentItems: { include: { product: true } },
              payments: true,
              thirdParty: { include: { supplier: true, customer: true } },
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

    return this.documentsQuery.findOne(id);
  }

  /** Anular es genérico para todos los tipos: revierte los movimientos de inventario y borra las CxP/CxC del documento. */
  async void(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: {
          select: { id: true, productId: true, quantity: true },
        },
        derivedDocuments: { select: { id: true, status: true } },
        inventoryMovements: {
          include: { documentItem: { select: { unitCost: true } } },
        },
        accountsPayable: {
          include: {
            payablePayments: true,
            creditApplications: true,
            egresoAllocations: true,
          },
        },
        accountsReceivable: {
          include: { receivablePayments: true, reciboCajaAllocations: true },
        },
        supplierCredits: { include: { applications: true } },
        customerCredits: { include: { applications: true } },
        appliedCustomerCredits: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    assertDocumentPermission(
      user,
      document.type,
      SALE_VOID_TYPES.has(document.type) ? 'void' : 'create',
    );

    if (document.status !== DocumentStatus.confirmed) {
      throw new ConflictException(
        'Solo se pueden anular documentos confirmados',
      );
    }

    // No se puede anular una preventa/remisión ya convertida: la venta derivada seguiría consumiendo la reserva liberada.
    if (
      RESERVATION_TYPES.includes(document.type) &&
      document.derivedDocuments.some((d) => d.status !== DocumentStatus.voided)
    ) {
      throw new ConflictException(
        'No se puede anular: este documento fue convertido a una venta. Anule primero el documento de venta derivado.',
      );
    }

    // Un pago saldado 100% con nota crédito no deja fila de pago propia; hay que chequear también las notas crédito aplicadas.
    const hasPayments = document.accountsPayable.some(
      (payable) =>
        payable.payablePayments.length > 0 ||
        payable.creditApplications.length > 0 ||
        payable.egresoAllocations.length > 0,
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

    // Igual del lado cliente: si el saldo a favor de esta DVV ya se aplicó a una
    // venta, anularla lo dejaría inconsistente. Primero hay que anular la venta.
    const hasCustomerCreditApplications = document.customerCredits.some(
      (credit) => credit.applications.length > 0,
    );

    if (hasCustomerCreditApplications) {
      throw new ConflictException(
        'No se puede anular: el saldo a favor generado por esta devolución ya fue aplicado en una venta',
      );
    }

    // La venta a crédito genera una cuenta por cobrar; si ya recibió pagos no se
    // puede anular (quedarían sueltos). Mismo criterio que la cuenta por pagar de arriba.
    const hasReceivablePayments = document.accountsReceivable.some(
      (receivable) =>
        receivable.receivablePayments.length > 0 ||
        receivable.reciboCajaAllocations.length > 0,
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
          data: {
            status: DocumentStatus.voided,
            voidedById: user.sub,
            voidedAt: new Date(),
          },
        });

        if (claimed.count === 0) {
          throw new ConflictException(
            'Solo se pueden anular documentos confirmados',
          );
        }

        // Anular una preventa/remisión libera toda la reserva de una vez; se anota igual que una liberación manual.
        const strategy = this.effectsRegistry.get(document.type);
        if (isReservationStrategy(strategy)) {
          // Relee las líneas dentro de la transacción: el dato de afuera podría estar viejo si alguien liberó justo antes.
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

        // Si nació de una conversión, devuelve las unidades convertidas al origen o esa reserva nunca vuelve a estar disponible.
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

        // El costo solo se revierte en CM/EAI, y solo si el movimiento a anular es el último del producto (cacheado por producto, excluye este documento).
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
            // Excluye líneas del mismo documento por fecha de creación; solo cuenta consumo real (no traslados ni anulaciones).
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

            const reversedAvgCost = await calculateAvgCostAfterVoid(
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
              const resolvedLastCost = await findLastPurchaseCostAfterVoid(
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

          // Si revertir quita stock de la tienda, hay que frenar si pisaría una reserva de preventa/remisión.
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

        // Re-chequeo con FOR UPDATE (mismo orden que EgresosService) por si un egreso concurrente pagó esto entre el chequeo de arriba y acá.
        await tx.$queryRaw`SELECT id FROM "accounts_payable" WHERE document_id = ${id}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "accounts_receivable" WHERE document_id = ${id}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "supplier_credit" WHERE source_document_id = ${id}::uuid FOR UPDATE`;

        const [freshPayables, freshReceivables] = await Promise.all([
          tx.accountsPayable.findMany({
            where: { documentId: id },
            include: {
              payablePayments: true,
              creditApplications: true,
              egresoAllocations: true,
            },
          }),
          tx.accountsReceivable.findMany({
            where: { documentId: id },
            include: { receivablePayments: true, reciboCajaAllocations: true },
          }),
        ]);

        const stillHasPayablePayments = freshPayables.some(
          (payable) =>
            payable.payablePayments.length > 0 ||
            payable.creditApplications.length > 0 ||
            payable.egresoAllocations.length > 0,
        );
        if (stillHasPayablePayments) {
          throw new ConflictException(
            'No se puede anular: la cuenta por pagar ya tiene pagos registrados',
          );
        }

        const stillHasReceivablePayments = freshReceivables.some(
          (receivable) =>
            receivable.receivablePayments.length > 0 ||
            receivable.reciboCajaAllocations.length > 0,
        );
        if (stillHasReceivablePayments) {
          throw new ConflictException(
            'No se puede anular: la cuenta por cobrar ya tiene pagos registrados',
          );
        }

        if (document.supplierCredits.length > 0) {
          const freshCredit = await tx.supplierCredit.findUnique({
            where: { sourceDocumentId: id },
            include: { applications: true },
          });
          if (freshCredit && freshCredit.applications.length > 0) {
            throw new ConflictException(
              'No se puede anular: la nota crédito generada por este documento ya fue aplicada a un pago',
            );
          }
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

        // DVV anulada: borra el saldo a favor que generó (ya se verificó que no
        // tiene aplicaciones).
        if (document.customerCredits.length > 0) {
          await tx.customerCredit.deleteMany({
            where: { sourceDocumentId: id },
          });
        }

        // POS/COT anulada: restituye los saldos a favor que la venta había
        // aplicado (restaura el balance y borra las aplicaciones).
        if (document.appliedCustomerCredits.length > 0) {
          await undoCustomerCreditApplications(tx, id);
        }
      },
      { timeout: 30000 },
    );

    return this.documentsQuery.findOne(id);
  }

  async remove(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({ where: { id } });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    assertDocumentPermission(user, document.type);

    if (document.status !== DocumentStatus.draft) {
      throw new ConflictException(
        'Solo se pueden eliminar documentos en borrador',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.documentPayment.deleteMany({ where: { documentId: id } });
      await tx.documentItem.deleteMany({ where: { documentId: id } });
      return tx.document.delete({ where: { id } });
    });
  }

  /** Libera, total o parcialmente, la reserva pendiente de un documento confirmado (solo preventas y remisiones). */
  async releaseItems(
    id: string,
    releaseItemsDto: ReleaseItemsDto,
    user: JwtPayload,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        documentItems: { include: { product: true } },
        payments: true,
        thirdParty: { include: { supplier: true, customer: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    assertDocumentPermission(user, document.type, 'release');

    if (document.status !== DocumentStatus.confirmed) {
      throw new ConflictException(
        'Solo se pueden liberar reservas de documentos confirmados',
      );
    }

    const strategy = this.effectsRegistry.getReservation(document.type);

    await this.prisma.$transaction(async (tx) => {
      // Re-chequeo bajo lock: una anulación concurrente no puede colarse entre el chequeo de arriba y la liberación.
      const status = await lockDocumentStatus(tx, id);
      if (status !== DocumentStatus.confirmed) {
        throw new ConflictException(
          'Solo se pueden liberar reservas de documentos confirmados',
        );
      }

      await strategy.releaseItems(
        tx,
        document,
        releaseItemsDto.items,
        user.sub,
        releaseItemsDto.notes,
      );
    });

    return this.documentsQuery.findOne(id);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async nextNumber(tx: Prisma.TransactionClient, type: DocumentType) {
    // Antes calculaba MAX(number)+1 sin lock (repetía número bajo concurrencia); ahora delega en SequenceService.
    return this.sequenceService.next(tx, type);
  }
}
