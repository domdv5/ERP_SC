import type {
  CreditListResponse,
  CustomerCreditsDetail,
  SupplierCreditsDetail,
} from '@contracts/credits'
import { api } from './api'
import type { ApiResponse } from '@/types'

export type CreditsParty = 'customers' | 'suppliers'

export interface GetCreditsParams {
  search?: string
  onlyAvailable?: boolean
  page?: number
  limit?: number
}

export async function getCredits(
  party: CreditsParty,
  params: GetCreditsParams,
): Promise<CreditListResponse> {
  const res = await api.get<ApiResponse<CreditListResponse>>(`/credits/${party}`, {
    // Apagado se omite el parámetro: el backend solo lo lee cuando viene "true"
    params: { ...params, onlyAvailable: params.onlyAvailable ? true : undefined },
  })
  return res.data.data
}

export async function getCustomerCredits(id: string): Promise<CustomerCreditsDetail> {
  const res = await api.get<ApiResponse<CustomerCreditsDetail>>(`/credits/customers/${id}`)
  return res.data.data
}

export async function getSupplierCredits(id: string): Promise<SupplierCreditsDetail> {
  const res = await api.get<ApiResponse<SupplierCreditsDetail>>(`/credits/suppliers/${id}`)
  return res.data.data
}
