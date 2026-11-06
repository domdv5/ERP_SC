// Contrato de reportes: GET /reports/*, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Los montos salen de SQL como float8: viajan como number, no como string.

export interface WarehouseStockRow {
  warehouseId: string;
  name: string;
  units: number;
  costValue: number;
  productCount: number;
}

// GET /reports/inventory
export interface InventoryReport {
  warehouses: WarehouseStockRow[];
  totals: { units: number; costValue: number; productCount: number };
}

export interface RotationRow {
  productId: string;
  code: string;
  description: string;
  unitsSold: number;
  salesAmount: number;
  stock: number;
}

// GET /reports/rotation
export interface RotationReport {
  top: RotationRow[];
  bottom: RotationRow[];
}

export interface AccountTotals {
  total: number;
  paid: number;
  balance: number;
  openCount: number;
}

export interface ThirdPartyBalanceRow {
  thirdPartyId: string;
  name: string;
  balance: number;
}

// GET /reports/accounts
export interface AccountsReport {
  payable: AccountTotals;
  receivable: AccountTotals;
  topSuppliers: ThirdPartyBalanceRow[];
  topCustomers: ThirdPartyBalanceRow[];
}

export interface SellerSalesRow {
  sellerId: string;
  name: string;
  grossSales: number;
  returns: number;
  netSales: number;
  documentCount: number;
}

export interface SalesTrendPoint {
  date: string;
  netSales: number;
}

// GET /reports/sales-by-seller
export interface SalesBySellerReport {
  sellers: SellerSalesRow[];
  unassignedSales: number;
  unassignedReturns: number;
  trend: SalesTrendPoint[];
}
