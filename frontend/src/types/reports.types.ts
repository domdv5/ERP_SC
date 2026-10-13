export interface WarehouseStockRow {
  warehouseId: string
  name: string
  units: number
  costValue: number
  productCount: number
}

export interface InventoryReport {
  warehouses: WarehouseStockRow[]
  totals: { units: number; costValue: number; productCount: number }
}

export interface RotationRow {
  productId: string
  code: string
  description: string
  unitsSold: number
  salesAmount: number
  stock: number
}

export interface RotationReport {
  top: RotationRow[]
  bottom: RotationRow[]
}

export interface AccountTotals {
  total: number
  paid: number
  balance: number
  openCount: number
}

export interface ThirdPartyBalanceRow {
  thirdPartyId: string
  name: string
  balance: number
}

export interface AccountsReport {
  payable: AccountTotals
  receivable: AccountTotals
  topSuppliers: ThirdPartyBalanceRow[]
  topCustomers: ThirdPartyBalanceRow[]
}

export interface SellerSalesRow {
  sellerId: string
  name: string
  grossSales: number
  returns: number
  netSales: number
  documentCount: number
}

export interface SalesTrendPoint {
  date: string
  netSales: number
}

export interface SalesBySellerReport {
  sellers: SellerSalesRow[]
  unassignedSales: number
  unassignedReturns: number
  trend: SalesTrendPoint[]
}

export interface ReportRangeParams {
  from: string
  to: string
}

export interface GetRotationReportParams extends ReportRangeParams {
  warehouseId?: string
  limit?: number
}
