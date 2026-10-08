export type ThirdPartyRole = 'customer' | 'supplier' | 'seller';

export interface ThirdPartyRoleFlags {
  isCustomer?: boolean;
  isSupplier?: boolean;
  isSeller?: boolean;
}

const ROLE_FLAGS: ReadonlyArray<[ThirdPartyRole, keyof ThirdPartyRoleFlags]> = [
  ['customer', 'isCustomer'],
  ['supplier', 'isSupplier'],
  ['seller', 'isSeller'],
];

// Exige thirdparty.role.{tipo} por cada tipo que el tercero ya tiene y por cada casilla que el cambio altere.
export function missingThirdPartyRoles(
  permissions: readonly string[],
  current: ThirdPartyRoleFlags | null,
  change: ThirdPartyRoleFlags,
): ThirdPartyRole[] {
  return ROLE_FLAGS.filter(([, flag]) => {
    const before = current?.[flag] ?? false;
    const after = change[flag] ?? before;
    return before || after;
  })
    .map(([role]) => role)
    .filter((role) => !permissions.includes(`thirdparty.role.${role}`));
}
