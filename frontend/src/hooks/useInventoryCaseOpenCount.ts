import { useQuery } from '@tanstack/react-query'
import { getInventoryCaseOpenCount } from '@/services/inventory-cases.service'

// Sin polling ni websockets: el contador se actualiza al volver a la pestaña o al invalidar tras un cambio.
export function useInventoryCaseOpenCount() {
  return useQuery({
    queryKey: ['inventory-cases', 'open-count'],
    queryFn: getInventoryCaseOpenCount,
    select: (data) => data.count,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })
}
