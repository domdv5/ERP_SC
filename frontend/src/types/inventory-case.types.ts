export type {
  InventoryCaseCause,
  InventoryCaseDetail,
  InventoryCaseDocumentRef,
  InventoryCaseListResponse,
  InventoryCaseMovement,
  InventoryCaseOpenCount,
  InventoryCaseReport,
  InventoryCaseRow,
  InventoryCaseStatus,
  InventoryCaseUserRef,
  InventoryCaseWarehouse,
} from '@contracts/inventory-cases'

import type { InventoryCaseCause, InventoryCaseStatus } from '@contracts/inventory-cases'

export interface GetInventoryCasesParams {
  page?: number
  limit?: number
  status?: InventoryCaseStatus
  warehouseId?: string
  from?: string
  to?: string
  search?: string
}

export interface GetInventoryCaseReportParams {
  from?: string
  to?: string
  warehouseId?: string
}

export interface CloseInventoryCasePayload {
  cause: Exclude<InventoryCaseCause, 'ajuste_anulado'>
  justification: string
  originDocumentId?: string
}
