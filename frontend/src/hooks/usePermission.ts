import { useAuthStore } from '@/stores/auth.store'

export function usePermission(permission: string): boolean {
  return useAuthStore((s) => s.hasPermission(permission))
}

export function usePermissions(permissions: string[]): boolean {
  const user = useAuthStore((s) => s.user)
  return permissions.every((p) => user?.permissions.includes(p) ?? false)
}
