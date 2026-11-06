import { api } from './api'
import type {
  ApiResponse,
  ThirdPartyCreated,
  ThirdPartyDetail,
  ThirdPartyListResponse,
  CreateThirdPartyPayload,
  UpdateThirdPartyPayload,
  CustomerBranchInput,
} from '@/types'

export interface GetThirdPartiesParams {
  page?: number
  limit?: number
  search?: string
  isCustomer?: boolean
  isSupplier?: boolean
  isSeller?: boolean
  isReceiver?: boolean
  isActive?: boolean
}

export async function getThirdParties(
  params?: GetThirdPartiesParams,
): Promise<ThirdPartyListResponse> {
  const res = await api.get<ApiResponse<ThirdPartyListResponse>>('/third-parties', { params })
  return res.data.data
}

export async function getThirdParty(id: string): Promise<ThirdPartyDetail> {
  const res = await api.get<ApiResponse<ThirdPartyDetail>>(`/third-parties/${id}`)
  return res.data.data
}

export async function createThirdParty(
  payload: CreateThirdPartyPayload,
): Promise<ThirdPartyCreated> {
  const res = await api.post<ApiResponse<ThirdPartyCreated>>('/third-parties', payload)
  return res.data.data
}

export async function updateThirdParty(
  id: string,
  payload: UpdateThirdPartyPayload,
): Promise<ThirdPartyDetail> {
  const res = await api.patch<ApiResponse<ThirdPartyDetail>>(`/third-parties/${id}`, payload)
  return res.data.data
}

export async function renameBrand(
  thirdPartyId: string,
  brandId: string,
  name: string,
): Promise<void> {
  await api.patch(`/third-parties/${thirdPartyId}/brands/${brandId}`, { name })
}

export async function updateCustomerBranch(
  thirdPartyId: string,
  branchId: string,
  data: CustomerBranchInput,
): Promise<void> {
  await api.patch(`/third-parties/${thirdPartyId}/branches/${branchId}`, data)
}

export async function deleteThirdParty(id: string): Promise<void> {
  await api.delete(`/third-parties/${id}`)
}

export async function reactivateThirdParty(id: string): Promise<void> {
  await api.post(`/third-parties/${id}/reactivate`)
}
