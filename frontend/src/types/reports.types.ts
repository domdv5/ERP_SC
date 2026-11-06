export type {
  AccountsReport,
  AccountTotals,
  InventoryReport,
  RotationReport,
  RotationRow,
  SalesBySellerReport,
  SalesTrendPoint,
  SellerSalesRow,
  ThirdPartyBalanceRow,
  WarehouseStockRow,
} from '@contracts/reports'

export interface ReportRangeParams {
  from: string
  to: string
}

export interface GetRotationReportParams extends ReportRangeParams {
  warehouseId?: string
  limit?: number
}
