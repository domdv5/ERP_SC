// Quien vende a crédito (COT) o fija cupos ve el cupo; los demás roles nunca lo reciben.
export const CREDIT_VIEW_PERMISSIONS = [
  'document.create.COT',
  'customer.credit.update',
] as const;

export function canSeeCustomerCredit(
  permissions: readonly string[],
  isCustomerFilter: boolean | undefined,
): boolean {
  if (isCustomerFilter !== true) return false;
  return CREDIT_VIEW_PERMISSIONS.some((permission) =>
    permissions.includes(permission),
  );
}
