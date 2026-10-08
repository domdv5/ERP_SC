export type ThirdPartyRole = 'customer' | 'supplier' | 'seller'

export interface ThirdPartyRoleFlags {
  isCustomer?: boolean
  isSupplier?: boolean
  isSeller?: boolean
}

const ROLE_FLAGS: ReadonlyArray<[ThirdPartyRole, keyof ThirdPartyRoleFlags]> = [
  ['customer', 'isCustomer'],
  ['supplier', 'isSupplier'],
  ['seller', 'isSeller'],
]

export function canAssignThirdPartyRole(
  role: ThirdPartyRole,
  permissions: readonly string[],
): boolean {
  return permissions.includes(`thirdparty.role.${role}`)
}

// Igual que el backend: solo se edita un tercero si el usuario tiene permiso para todos los tipos que ya tiene.
export function canEditThirdParty(
  thirdParty: ThirdPartyRoleFlags,
  permissions: readonly string[],
): boolean {
  return ROLE_FLAGS.every(
    ([role, flag]) => !thirdParty[flag] || canAssignThirdPartyRole(role, permissions),
  )
}
