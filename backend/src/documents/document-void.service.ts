import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentStatus, DocumentType, MovementType } from '@/common/enums';
import type { JwtPayload } from '@/common/types';
import { PrismaService } from '@/prisma/prisma.service';
import { undoCustomerCreditApplications } from './helpers/customer-credit.helpers';
import {
  assertAvailableForReservation,
  RESERVATION_TYPES,
} from './helpers/reservation.helpers';
import { applyBinStockChange, applyStockChange } from './helpers/stock.helpers';
import { assertDocumentPermission } from './helpers/document-guards.helpers';
import { DocumentsQueryService } from './documents-query.service';
import {
  DOCUMENT_TO_VOID_INCLUDE,
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
export class DocumentVoidService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectsRegistry: DocumentEffectsRegistry,
    private readonly documentsQuery: DocumentsQueryService,
  ) {}

  /** Anular es genérico para todos los tipos: revierte los movimientos de inventario y borra las CxP/CxC del documento. */
  async void(id: string, user: JwtPayload) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: DOCUMENT_TO_VOID_INCLUDE,
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

        const strategy = this.effectsRegistry.get(document.type);
        await strategy.undoEffects?.(tx, document, user.sub);

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

        // Se cachea por bodega: las líneas de un mismo documento casi siempre
        // comparten bodega, así no se repite la consulta del tipo de bodega.
        const warehouseTypeCache = new Map<string, string>();

        for (const movement of document.inventoryMovements) {
          const quantity = movement.quantity;

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
}
