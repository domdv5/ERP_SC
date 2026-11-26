import { Navigate } from 'react-router-dom'
import { findHomePath } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth.store'

export function HomeRedirect() {
  const user = useAuthStore((state) => state.user)
  return <Navigate to={findHomePath(user?.permissions ?? [])} replace />
}
