import { api } from './api'
import type {
  CreateExcessBody,
  ExcessItem,
  ExcessListResponse,
  ExcessPartyType,
  ExcessStatus,
  VoidExcessBody,
} from '@contracts/excesses'
import type { ApiResponse } from '@/types'

export interface GetExcessesParams {
  partyType: ExcessPartyType
  search?: string
  status?: ExcessStatus
  page?: number
  limit?: number
}

export async function getExcesses(params: GetExcessesParams): Promise<ExcessListResponse> {
  const res = await api.get<ApiResponse<ExcessListResponse>>('/excesses', { params })
  return res.data.data
}

export async function createExcess(body: CreateExcessBody): Promise<ExcessItem> {
  const res = await api.post<ApiResponse<ExcessItem>>('/excesses', body)
  return res.data.data
}

export async function voidExcess(
  partyType: ExcessPartyType,
  id: string,
  body: VoidExcessBody,
): Promise<ExcessItem> {
  const path = partyType === 'customer' ? 'customers' : 'suppliers'
  const res = await api.post<ApiResponse<ExcessItem>>(`/excesses/${path}/${id}/void`, body)
  return res.data.data
}
