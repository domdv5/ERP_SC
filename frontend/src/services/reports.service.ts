import { api } from './api'
import type { ApiResponse } from '@/types'
import type {
  InventoryReport,
  RotationReport,
  AccountsReport,
  SalesBySellerReport,
  ReportRangeParams,
  GetRotationReportParams,
} from '@/types/reports.types'

export async function getInventoryReport(): Promise<InventoryReport> {
  const res = await api.get<ApiResponse<InventoryReport>>('/reports/inventory')
  return res.data.data
}

export async function getRotationReport(params: GetRotationReportParams): Promise<RotationReport> {
  const res = await api.get<ApiResponse<RotationReport>>('/reports/rotation', { params })
  return res.data.data
}

export async function getAccountsReport(limit = 10): Promise<AccountsReport> {
  const res = await api.get<ApiResponse<AccountsReport>>('/reports/accounts', {
    params: { limit },
  })
  return res.data.data
}

export async function getSalesBySellerReport(
  params: ReportRangeParams,
): Promise<SalesBySellerReport> {
  const res = await api.get<ApiResponse<SalesBySellerReport>>('/reports/sales-by-seller', {
    params,
  })
  return res.data.data
}
