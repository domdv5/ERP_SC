import { ErrorPage } from '@/components/shared/ErrorPage'
import { useAuthStore } from '@/stores/auth.store'

interface PermissionGuardProps {
  // string → exige ese permiso; string[] → basta con tener alguno (OR).
  permission: string | string[]
  children: React.ReactNode
}

export function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const permissions = Array.isArray(permission) ? permission : [permission]
  const allowed = permissions.some((permissionName) => hasPermission(permissionName))
  if (!allowed) return <ErrorPage variant="forbidden" />
  return <>{children}</>
}
