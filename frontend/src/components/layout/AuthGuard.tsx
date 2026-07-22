import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  // isAuthenticated solo refleja si hay token guardado (persistido en localStorage
  // vía zustand/persist) — no valida su expiración aquí. El JWT vive 8h; cuando
  // expira, el interceptor 401 de api.ts limpia el store y redirige a /login,
  // así este guard vuelve a bloquear en el próximo render.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
