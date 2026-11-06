export type {
  CustomerBranch,
  ThirdPartyCreated,
  ThirdPartyDetail,
  ThirdPartyListResponse,
  CreateThirdPartyPayload,
  UpdateThirdPartyPayload,
  CustomerBranchInput,
  PersonType,
  DocumentType as ThirdPartyDocumentType,
} from './third-party.types'
export type { Department } from './location.types'
export type { City } from './location.types'
export type {
  BrandOption,
  Gender,
  ProductBrand,
  ProductByCode,
  ProductCategory,
  ProductDetail,
  ProductListItem,
  ProductListMeta,
  ProductListResponse,
  ProductLocation,
  ProductLocationsResult,
  ProductRecord,
  StockByWarehouse,
  UnitOfMeasure,
} from './product.types'
export type {
  Bin,
  BinWithStock,
  WarehouseDetail,
  WarehouseListItem,
  WarehouseRecord,
  WarehouseType,
  Zone,
  ZoneWithBins,
  CreateWarehousePayload,
  UpdateWarehousePayload,
  CreateZonePayload,
  UpdateZonePayload,
  CreateBinPayload,
  UpdateBinPayload,
} from './warehouse.types'
export type {
  DocumentType,
  DocumentStatus,
  DocumentListItem,
  DocumentDetail,
  DocumentItem,
  DocumentMeta,
  DocumentWarehouse,
  DocumentThirdParty,
  DocumentUser,
  DocumentBin,
  DocumentSourceRef,
  GetDocumentsParams,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  CreateDocumentItemPayload,
  ReleaseItemsPayload,
  ReleaseDocumentItemPayload,
} from './document.types'
export type {
  AccountsPayable,
  AccountsPayableDetail,
  AccountsPayableHistoryEntry,
  AccountsPayableListMeta,
  AccountsPayableStatus,
  GetPayableSuppliersParams,
  PayableDocument,
  PayableDocumentRef,
  PayableSupplier,
  PayableSuppliersResponse,
  PayableSuppliersSort,
  PayableSuppliersStatus,
  PayableSupplierSummary,
  SupplierCredit,
  SupplierCreditApplication,
  SupplierCreditWithApplications,
  SupplierStatement,
  SupplierStatementTotals,
} from './accounts-payable.types'
export type {
  Egreso,
  EgresoAllocation,
  EgresoAllocationAccountPayable,
  EgresoCredit,
  EgresoCreditApplication,
  EgresoListItem,
  EgresoListMeta,
  EgresoListResponse,
  EgresoOpenItems,
  EgresoOpenPayable,
  EgresoPaymentLine,
  EgresoPaymentMethod,
  GetEgresosParams,
  CreateEgresoPayload,
  CreateEgresoPayablePayload,
  CreateEgresoCreditPayload,
  CreateEgresoPaymentPayload,
} from './egreso.types'
export { EGRESO_PAYMENT_METHOD_LABELS } from './egreso.types'
export type {
  AccountsReceivable,
  AccountsReceivableDetail,
  AccountsReceivableHistoryEntry,
  AccountsReceivableListMeta,
  AccountsReceivableStatus,
  ClientBranchTotal,
  ClientCredit,
  ClientCreditApplication,
  ClientStatement,
  ClientStatementTotals,
  CreateExcedentePayload,
  CustomerCreditKind,
  CustomerCreditUsableIn,
  GetReceivableClientsParams,
  ReceivableClient,
  ReceivableClientsResponse,
  ReceivableClientsSort,
  ReceivableClientsStatus,
  ReceivableClientSummary,
  ReceivableDocument,
  ReceivableDocumentRef,
} from './accounts-receivable.types'
export type {
  ReciboCaja,
  ReciboCajaAllocation,
  ReciboCajaAllocationAccountReceivable,
  ReciboCajaBranch,
  ReciboCajaCreditApplication,
  ReciboCajaDiscountReason,
  ReciboCajaListItem,
  ReciboCajaListMeta,
  ReciboCajaListResponse,
  ReciboCajaOpenCredit,
  ReciboCajaOpenItems,
  ReciboCajaOpenReceivable,
  ReciboCajaPaymentLine,
  GetRecibosCajaParams,
  CreateReciboCajaCreditPayload,
  CreateReciboCajaPayload,
  CreateReciboCajaReceivablePayload,
  CreateReciboCajaPaymentPayload,
} from './recibo-caja.types'
export type { SystemStatus, SystemStatusActivatedBy } from './system.types'
export type {
  OfficialLedgerItem,
  OfficialLedgerListResponse,
  OfficialLedgerTotals,
  OfficialLedgerMeta,
  GetOfficialLedgerParams,
  GetOfficialLedgerMovementsParams,
  OfficialLedgerMovement,
  OfficialLedgerProductDetail,
} from './official-ledger.types'

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface JwtPayload {
  sub: number
  name: string
  username: string
  permissions: string[]
  roles: string[]
}

export interface User {
  id: number
  name: string
  username: string
  permissions: string[]
  roles: string[]
}
