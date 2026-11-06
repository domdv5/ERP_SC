import { api } from './api'
import type {
  ApiResponse,
  GetOfficialLedgerMovementsParams,
  GetOfficialLedgerParams,
  OfficialLedgerListResponse,
  OfficialLedgerProductDetail,
} from '@/types'

export async function getOfficialLedger(
  params?: GetOfficialLedgerParams,
): Promise<OfficialLedgerListResponse> {
  const res = await api.get<ApiResponse<OfficialLedgerListResponse>>('/official-ledger', { params })
  return res.data.data
}

export async function getOfficialLedgerProduct(
  productId: string,
  params?: GetOfficialLedgerMovementsParams,
): Promise<OfficialLedgerProductDetail> {
  const res = await api.get<ApiResponse<OfficialLedgerProductDetail>>(
    `/official-ledger/products/${productId}`,
    { params },
  )
  return res.data.data
}
