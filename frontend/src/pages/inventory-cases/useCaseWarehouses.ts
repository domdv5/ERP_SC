import { useQuery } from '@tanstack/react-query'
import { getInventoryCaseWarehouses } from '@/services/inventory-cases.service'

export function useCaseWarehouses() {
  const { data: warehouses = [] } = useQuery({
    queryKey: ['inventory-cases', 'warehouses'],
    queryFn: getInventoryCaseWarehouses,
    staleTime: 5 * 60 * 1000,
  })
  return { warehouses }
}
