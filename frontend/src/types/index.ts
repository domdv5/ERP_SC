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
  DocumentVoidReason,
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
export { DOCUMENT_VOID_REASON_LABELS, DOCUMENT_VOID_REASONS_BY_TYPE } from './document.types'
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
  SupplierPayment,
  SupplierPaymentAllocation,
  SupplierPaymentAllocationAccountPayable,
  SupplierPaymentCredit,
  SupplierPaymentCreditApplication,
  SupplierPaymentListItem,
  SupplierPaymentListMeta,
  SupplierPaymentListResponse,
  SupplierPaymentOpenItems,
  SupplierPaymentOpenPayable,
  SupplierPaymentMethodLine,
  TreasuryPaymentMethod,
  SupplierPaymentVoidReason,
  GetSupplierPaymentsParams,
  CreateSupplierPaymentPayload,
  CreateSupplierPaymentPayablePayload,
  CreateSupplierPaymentCreditPayload,
  CreateSupplierPaymentMethodPayload,
} from './supplier-payment.types'
export {
  TREASURY_PAYMENT_METHOD_LABELS,
  SUPPLIER_PAYMENT_VOID_REASON_LABELS,
} from './supplier-payment.types'
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
  CustomerPayment,
  CustomerPaymentAllocation,
  CustomerPaymentAllocationAccountReceivable,
  CustomerPaymentBranch,
  CustomerPaymentCreditApplication,
  CustomerPaymentDiscountReason,
  CustomerPaymentListItem,
  CustomerPaymentListMeta,
  CustomerPaymentListResponse,
  CustomerPaymentOpenCredit,
  CustomerPaymentOpenItems,
  CustomerPaymentOpenReceivable,
  CustomerPaymentMethodLine,
  GetCustomerPaymentsParams,
  CreateCustomerPaymentCreditPayload,
  CreateCustomerPaymentPayload,
  CreateCustomerPaymentReceivablePayload,
  CreateCustomerPaymentMethodPayload,
  CustomerPaymentVoidReason,
} from './customer-payment.types'
export { CUSTOMER_PAYMENT_VOID_REASON_LABELS } from './customer-payment.types'
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
