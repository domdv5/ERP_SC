import { Navigate } from 'react-router-dom'
import { usePermission } from '@/hooks/usePermission'

interface PermissionGuardProps {
  permission: string
  children: React.ReactNode
  redirectTo?: string
}

export function PermissionGuard({ permission, children, redirectTo = '/dashboard' }: PermissionGuardProps) {
  const hasPermission = usePermission(permission)
  if (!hasPermission) return <Navigate to={redirectTo} replace />
  return <>{children}</>
}
