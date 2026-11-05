import { api } from './api'
import type { ApiResponse } from '@/types'
import type {
  CloseInventoryCasePayload,
  GetInventoryCaseReportParams,
  GetInventoryCasesParams,
  InventoryCaseDetail,
  InventoryCaseListResponse,
  InventoryCaseOpenCount,
  InventoryCaseReport,
  InventoryCaseWarehouse,
} from '@/types/inventory-case.types'

export async function getInventoryCases(
  params: GetInventoryCasesParams,
): Promise<InventoryCaseListResponse> {
  const res = await api.get<ApiResponse<InventoryCaseListResponse>>('/inventory-cases', { params })
  return res.data.data
}

export async function getInventoryCaseOpenCount(): Promise<InventoryCaseOpenCount> {
  const res = await api.get<ApiResponse<InventoryCaseOpenCount>>('/inventory-cases/open-count')
  return res.data.data
}

export async function getInventoryCase(id: string): Promise<InventoryCaseDetail> {
  const res = await api.get<ApiResponse<InventoryCaseDetail>>(`/inventory-cases/${id}`)
  return res.data.data
}

export async function closeInventoryCase(
  id: string,
  payload: CloseInventoryCasePayload,
): Promise<InventoryCaseDetail> {
  const res = await api.post<ApiResponse<InventoryCaseDetail>>(
    `/inventory-cases/${id}/close`,
    payload,
  )
  return res.data.data
}

export async function reopenInventoryCase(id: string): Promise<InventoryCaseDetail> {
  const res = await api.post<ApiResponse<InventoryCaseDetail>>(`/inventory-cases/${id}/reopen`)
  return res.data.data
}

export async function getInventoryCaseReport(
  params: GetInventoryCaseReportParams,
): Promise<InventoryCaseReport> {
  const res = await api.get<ApiResponse<InventoryCaseReport>>('/inventory-cases/report', {
    params,
  })
  return res.data.data
}

export async function getInventoryCaseWarehouses(): Promise<InventoryCaseWarehouse[]> {
  const res = await api.get<ApiResponse<InventoryCaseWarehouse[]>>('/inventory-cases/warehouses')
  return res.data.data
}
