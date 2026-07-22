import { useAuthStore } from '@/stores/auth.store'

/**
 * Verifica un permiso contra el array `permissions[]` ya incluido en el JWT
 * (cargado en el store al hacer login). No dispara ninguna request nueva:
 * los permisos quedan "horneados" en el token, así que consultarlos es
 * síncrono y local durante toda la sesión.
 */
export function usePermission(permission: string): boolean {
  return useAuthStore((s) => s.hasPermission(permission))
}

export function usePermissions(permissions: string[]): boolean {
  const user = useAuthStore((s) => s.user)
  return permissions.every((p) => user?.permissions.includes(p) ?? false)
}
