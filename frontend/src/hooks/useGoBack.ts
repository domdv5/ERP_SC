import { useNavigate } from 'react-router-dom'

/** Vuelve a la pantalla anterior; si se entró directo por URL (sin historial en la app) va a `fallbackPath`. */
export function useGoBack(fallbackPath: string) {
  const navigate = useNavigate()

  return () => {
    // React Router guarda en history.state.idx la posición dentro de la app: 0 = primera pantalla abierta.
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (index > 0) navigate(-1)
    else navigate(fallbackPath)
  }
}
