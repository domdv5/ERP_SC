import { useAuthStore } from '@/stores/auth.store'

// Lee permissions[] del JWT ya cargado en el store — síncrono, sin request nueva
export function usePermission(permission: string): boolean {
  return useAuthStore((s) => s.hasPermission(permission))
}

export function usePermissions(permissions: string[]): boolean {
  const user = useAuthStore((s) => s.user)
  return permissions.every((p) => user?.permissions.includes(p) ?? false)
}
