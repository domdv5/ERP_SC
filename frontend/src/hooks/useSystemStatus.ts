import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL } from '@/services/api'
import { getSystemStatus } from '@/services/system.service'
import { useAuthStore } from '@/stores/auth.store'
import type { SystemStatus } from '@/types'

// Singleton a nivel de módulo: una sola conexión SSE para toda la sesión aunque varios componentes usen el hook
let activeSubscribers = 0
let sharedEventSource: EventSource | null = null
let retryTimeout: ReturnType<typeof setTimeout> | null = null

// staleTime: Infinity porque la caché se actualiza solo por SSE, nunca por refetch
export function useSystemStatus() {
  const token = useAuthStore((s) => s.token)
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['system-status'],
    queryFn: getSystemStatus,
    staleTime: Infinity,
    enabled: !!token,
  })

  useEffect(() => {
    if (!token) return

    const connect = () => {
      sharedEventSource = new EventSource(`${API_BASE_URL}/system/status/stream?token=${token}`)
      sharedEventSource.onmessage = (event) => {
        // Sin el envoltorio estándar de la API: el backend manda `data` tal cual en la línea "data:"
        const parsed = JSON.parse(event.data) as { data: SystemStatus }
        queryClient.setQueryData(['system-status'], parsed.data)
      }
      sharedEventSource.onerror = () => {
        // EventSource reintenta solo salvo que el navegador cierre en CLOSED (respuesta HTTP no-SSE) — ese caso lo reintentamos a mano
        if (sharedEventSource?.readyState === EventSource.CLOSED) {
          sharedEventSource.close()
          sharedEventSource = null
          if (activeSubscribers > 0) {
            retryTimeout = setTimeout(connect, 3000)
          }
        }
      }
    }

    activeSubscribers += 1

    if (!sharedEventSource) {
      connect()
    }

    return () => {
      activeSubscribers -= 1
      if (activeSubscribers <= 0) {
        if (retryTimeout) {
          clearTimeout(retryTimeout)
          retryTimeout = null
        }
        if (sharedEventSource) {
          sharedEventSource.close()
          sharedEventSource = null
        }
        activeSubscribers = 0
      }
    }
  }, [token, queryClient])

  return query
}
