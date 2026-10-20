import { useQuery } from '@tanstack/react-query'
import { getThirdParty } from '@/services/third-parties.service'
import type { CustomerBranch } from '@/types'

const NO_BRANCHES: CustomerBranch[] = []

// El prefijo 'third-parties' de la key lo invalida invalidateThirdParties.
export function useCustomerBranches(customerId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['third-parties-customer-branches', customerId],
    queryFn: async () => (await getThirdParty(customerId!)).customer?.branches ?? NO_BRANCHES,
    enabled: Boolean(customerId),
    staleTime: 5 * 60 * 1000,
  })

  return { branches: data ?? NO_BRANCHES, isLoading }
}
