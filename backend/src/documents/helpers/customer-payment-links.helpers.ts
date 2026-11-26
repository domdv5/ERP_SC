export const CUSTOMER_PAYMENT_VOID_STATE = {
  select: { customerPayment: { select: { voidedAt: true } } },
} as const;

export const ACTIVE_CUSTOMER_PAYMENT_LINK = {
  OR: [{ customerPaymentId: null }, { customerPayment: { voidedAt: null } }],
};

export const VOIDED_CUSTOMER_PAYMENT_ROW = {
  customerPayment: { voidedAt: { not: null } },
} as const;

/** Un abono o saldo aplicado cuenta solo si no vino de un recibo anulado. */
export function isActiveCustomerPaymentLink(link: {
  customerPayment: { voidedAt: Date | null } | null;
}): boolean {
  return !link.customerPayment || link.customerPayment.voidedAt === null;
}
