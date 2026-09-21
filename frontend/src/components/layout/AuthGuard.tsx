import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  // No valida expiración del JWT acá; el interceptor 401 de api.ts limpia el store cuando expira.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
