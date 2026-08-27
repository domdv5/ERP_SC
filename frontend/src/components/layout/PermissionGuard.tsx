import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

interface PermissionGuardProps {
  // string → exige ese permiso; string[] → basta con tener alguno (OR).
  permission: string | string[]
  children: React.ReactNode
  redirectTo?: string
}

export function PermissionGuard({ permission, children, redirectTo = '/dashboard' }: PermissionGuardProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const perms = Array.isArray(permission) ? permission : [permission]
  const allowed = perms.some((p) => hasPermission(p))
  if (!allowed) return <Navigate to={redirectTo} replace />
  return <>{children}</>
}
