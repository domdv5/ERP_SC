import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  getInventoryReport,
  getRotationReport,
  getAccountsReport,
  getSalesBySellerReport,
} from '@/services/reports.service'
import type { ReportRangeParams } from '@/types/reports.types'

const STALE_TIME = 5 * 60 * 1000
const GC_TIME = 30 * 60 * 1000
const TOP_LIMIT = 10

// Cache solo en el front: los filtros van en la key y keepPreviousData evita gráficos vacíos al cambiar de rango.
const REPORT_QUERY_OPTIONS = {
  staleTime: STALE_TIME,
  gcTime: GC_TIME,
  placeholderData: keepPreviousData,
} as const

export function useInventoryReport() {
  return useQuery({
    queryKey: ['reports', 'inventory'],
    queryFn: getInventoryReport,
    ...REPORT_QUERY_OPTIONS,
  })
}

export function useRotationReport({ from, to }: ReportRangeParams, warehouseId: string | null) {
  return useQuery({
    queryKey: ['reports', 'rotation', from, to, warehouseId ?? 'all', TOP_LIMIT],
    queryFn: () =>
      getRotationReport({ from, to, limit: TOP_LIMIT, ...(warehouseId && { warehouseId }) }),
    ...REPORT_QUERY_OPTIONS,
  })
}

export function useAccountsReport() {
  return useQuery({
    queryKey: ['reports', 'accounts', TOP_LIMIT],
    queryFn: () => getAccountsReport(TOP_LIMIT),
    ...REPORT_QUERY_OPTIONS,
  })
}

export function useSalesBySellerReport({ from, to }: ReportRangeParams) {
  return useQuery({
    queryKey: ['reports', 'sales-by-seller', from, to],
    queryFn: () => getSalesBySellerReport({ from, to }),
    ...REPORT_QUERY_OPTIONS,
  })
}
