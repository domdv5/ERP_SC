import { Prisma } from '@prisma/client';
import type { CreateDocumentDto } from '../dto/index';
import { BRANCH_TYPES } from './customer-branch.helpers';

export const DUPLICATE_REQUEST_MESSAGE =
  'Esta operación ya se registró con datos distintos. Recarga la página y revisa el listado de operaciones.';

type Amount = number | string | Prisma.Decimal;

export type ExistingDocumentForIdempotency = {
  type: string;
  userId: string;
  date: Date;
  thirdPartyId: string | null;
  sellerId: string | null;
  receiverId: string | null;
  customerBranchId: string | null;
  paymentMethod: string | null;
  refundMethod: string | null;
  notes: string | null;
  warehouseId: string | null;
  destWarehouseId: string | null;
  destBinId: string | null;
  sourceBinId: string | null;
  adjustmentReason: string | null;
  adjustmentReasonOther: string | null;
  officialPurchase: boolean;
  supplierInvoiceNumber: string | null;
  sourceDocumentId: string | null;
  documentItems: {
    productId: string;
    quantity: number;
    unitPrice: Amount;
    unitCost: Amount;
    observaciones: string | null;
  }[];
};

const toFixed4 = (amount: Amount) => new Prisma.Decimal(amount).toFixed(4);

// Firma de todo lo que se guarda al crear; los ítems se ordenan para que el orden no cuente.
function signature(doc: ExistingDocumentForIdempotency): string {
  const items = doc.documentItems
    .map((item) =>
      JSON.stringify([
        item.productId,
        item.quantity,
        toFixed4(item.unitPrice),
        toFixed4(item.unitCost),
        item.observaciones ?? null,
      ]),
    )
    .sort();
  return JSON.stringify([
    doc.type,
    doc.userId,
    doc.date.toISOString().slice(0, 10),
    doc.thirdPartyId ?? null,
    doc.sellerId ?? null,
    doc.receiverId ?? null,
    doc.customerBranchId ?? null,
    doc.paymentMethod ?? null,
    doc.refundMethod ?? null,
    doc.notes ?? null,
    doc.warehouseId ?? null,
    doc.destWarehouseId ?? null,
    doc.destBinId ?? null,
    doc.sourceBinId ?? null,
    doc.adjustmentReason ?? null,
    doc.adjustmentReasonOther ?? null,
    doc.officialPurchase,
    doc.supplierInvoiceNumber ?? null,
    doc.sourceDocumentId ?? null,
    items,
  ]);
}

/** Compara el reintento contra el documento ya guardado con la misma clave: todos los campos que se guardan al crear, ítems sin importar el orden. */
export function isSameDocumentRequest(
  dto: CreateDocumentDto,
  existing: ExistingDocumentForIdempotency,
  userId: string,
): boolean {
  const requested: ExistingDocumentForIdempotency = {
    type: dto.type,
    userId,
    date: new Date(dto.date),
    thirdPartyId: dto.thirdPartyId ?? null,
    sellerId: dto.sellerId ?? null,
    // Solo la compra guarda quién recibió; en los demás tipos el campo se ignora.
    receiverId: dto.type === 'CM' ? (dto.receiverId ?? null) : null,
    // Solo las ventas guardan la sucursal; en los demás tipos el campo se ignora.
    customerBranchId: BRANCH_TYPES.has(dto.type)
      ? (dto.customerBranchId ?? null)
      : null,
    paymentMethod: dto.paymentMethod ?? null,
    refundMethod: dto.refundMethod ?? null,
    notes: dto.notes ?? null,
    // La tienda la asigna el backend; solo el traslado trae su bodega en el pedido.
    warehouseId:
      dto.type === 'T' ? (dto.warehouseId ?? null) : existing.warehouseId,
    destWarehouseId: dto.destWarehouseId ?? null,
    destBinId: dto.destBinId ?? null,
    sourceBinId: dto.sourceBinId ?? null,
    adjustmentReason: dto.adjustmentReason ?? null,
    adjustmentReasonOther: dto.adjustmentReasonOther ?? null,
    officialPurchase: dto.officialPurchase ?? false,
    supplierInvoiceNumber: dto.supplierInvoiceNumber?.trim() || null,
    sourceDocumentId: dto.sourceDocumentId ?? null,
    documentItems: dto.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? 0,
      unitCost: item.unitCost ?? 0,
      observaciones: item.observaciones ?? null,
    })),
  };
  return signature(requested) === signature(existing);
}

export function isIdempotencyKeyConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    ((error.meta?.target as string[] | undefined)?.includes(
      'idempotency_key',
    ) ??
      false)
  );
}
