import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL } from '@/services/api'
import { getSystemStatus } from '@/services/system.service'
import { useAuthStore } from '@/stores/auth.store'
import type { SystemStatus } from '@/types'

// Conteo de referencias a nivel de módulo: tanto AppLayout como Header llaman
// a este hook, pero solo debe existir UNA conexión SSE por sesión (advanced-init-once).
// El primer consumidor en montar abre el EventSource; el último en desmontar lo cierra.
let activeSubscribers = 0
let sharedEventSource: EventSource | null = null
// Vive a nivel de módulo (no dentro del efecto) por la misma razón que sharedEventSource:
// solo el suscriptor "fundador" ejecuta connect() y programa este timeout; si viviera en
// el closure de ese efecto, desmontar justo ese componente cancelaría el reintento aunque
// otro suscriptor (Header/AppLayout) siga montado y dependa de la reconexión.
let retryTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Estado del modo de solo lectura (cierre contable). El fetch inicial trae el
 * snapshot; a partir de ahí el SSE mantiene la caché fresca en tiempo real
 * para todos los usuarios conectados (incluyendo quien activó el toggle),
 * por eso `staleTime: Infinity` — nunca se refetch por tiempo, solo por SSE.
 */
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
      sharedEventSource = new EventSource(
        `${API_BASE_URL}/system/status/stream?token=${token}`,
      )
      sharedEventSource.onmessage = (event) => {
        // Nest sirve @Sse() con su propio writer: extrae el campo `data` del
        // MessageEvent devuelto por el controller y lo serializa tal cual en
        // la línea "data:" — un solo nivel de wrapping, sin {success,data}
        // (confirmado empíricamente contra el stream real, no el {success,data}
        // habitual del resto de la API).
        const parsed = JSON.parse(event.data) as { data: SystemStatus }
        queryClient.setQueryData(['system-status'], parsed.data)
      }
      sharedEventSource.onerror = () => {
        // Un rechazo de socket puro (backend caído, sin nada escuchando en el puerto) SÍ
        // dispara la reconexión automática nativa de EventSource (readyState vuelve a
        // CONNECTING) — verificado empíricamente matando el backend en dev. Pero si en
        // algún punto llega una respuesta HTTP real que no es un stream SSE válido (status
        // distinto de 200, o Content-Type incorrecto — típico si hay un reverse proxy/LB
        // delante que devuelve una página de error mientras el backend reinicia), la spec
        // obliga al navegador a cerrar la conexión de forma PERMANENTE (readyState CLOSED)
        // sin reintentar solo. Este handler es la red de seguridad para ese segundo caso.
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
