export const SUPPLIER_PAYMENT_VOID_STATE = {
  select: { supplierPayment: { select: { voidedAt: true } } },
} as const;

export const VOIDED_SUPPLIER_PAYMENT_ROW = {
  supplierPayment: { voidedAt: { not: null } },
} as const;

/** Un abono o saldo aplicado cuenta solo si no vino de un egreso anulado (sin egreso = pago histórico, sí cuenta). */
export function isActiveSupplierPaymentLink(link: {
  supplierPayment: { voidedAt: Date | null } | null;
}): boolean {
  return !link.supplierPayment || link.supplierPayment.voidedAt === null;
}
