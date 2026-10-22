import { useQuery } from '@tanstack/react-query'
import { getCities, getDepartments } from '@/services/locations.service'

// Catálogo DIVIPOLA: no cambia durante la sesión
export function useDepartments() {
  return useQuery({
    queryKey: ['locations', 'departments'],
    queryFn: getDepartments,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useCities(departmentCode: string) {
  return useQuery({
    queryKey: ['locations', 'cities', departmentCode],
    queryFn: () => getCities(departmentCode),
    enabled: Boolean(departmentCode),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
