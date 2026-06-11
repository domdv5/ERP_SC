import { api } from './api'
import type { ApiResponse, ThirdParty, CreateThirdPartyPayload, UpdateThirdPartyPayload } from '@/types'

export interface ThirdPartyMeta {
  total: number
  page: number
  limit: number
  totalPages: number
  customerCount: number
  supplierCount: number
}

export interface GetThirdPartiesParams {
  page?: number
  limit?: number
  search?: string
  isCustomer?: boolean
  isSupplier?: boolean
}

export async function getThirdParties(params?: GetThirdPartiesParams): Promise<{ items: ThirdParty[]; meta: ThirdPartyMeta }> {
  const res = await api.get<ApiResponse<{ items: ThirdParty[]; meta: ThirdPartyMeta }>>('/third-parties', { params })
  return res.data.data
}

export async function createThirdParty(payload: CreateThirdPartyPayload): Promise<ThirdParty> {
  const res = await api.post<ApiResponse<ThirdParty>>('/third-parties', payload)
  return res.data.data
}

export async function updateThirdParty(id: string, payload: UpdateThirdPartyPayload): Promise<ThirdParty> {
  const res = await api.patch<ApiResponse<ThirdParty>>(`/third-parties/${id}`, payload)
  return res.data.data
}

export async function deleteThirdParty(id: string): Promise<void> {
  await api.delete(`/third-parties/${id}`)
}
