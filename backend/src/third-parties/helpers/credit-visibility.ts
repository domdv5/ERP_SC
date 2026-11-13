// Quien vende a crédito (COT) o fija cupos ve el cupo; los demás roles nunca lo reciben.
export const CREDIT_VIEW_PERMISSIONS = [
  'document.create.COT',
  'customer.credit.update',
] as const;

export function canSeeCustomerCredit(permissions: readonly string[]): boolean {
  return CREDIT_VIEW_PERMISSIONS.some((permission) =>
    permissions.includes(permission),
  );
}

export function hideCreditLimit<
  T extends { customer: { creditLimit: unknown } | null },
>(thirdParty: T, permissions: readonly string[]): T {
  if (!thirdParty.customer || canSeeCustomerCredit(permissions)) {
    return thirdParty;
  }
  return {
    ...thirdParty,
    customer: { ...thirdParty.customer, creditLimit: null },
  };
}
