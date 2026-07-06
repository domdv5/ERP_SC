export type { ThirdParty, CreateThirdPartyPayload, UpdateThirdPartyPayload, PersonType, DocumentType as ThirdPartyDocumentType } from './third-party.types'
export type { Product } from './product.types'
export type {
  Warehouse, WarehouseType, WarehouseDetail,
  Zone, Bin, ZoneSummary,
  CreateWarehousePayload, UpdateWarehousePayload,
  CreateZonePayload, UpdateZonePayload,
  CreateBinPayload, UpdateBinPayload,
} from './warehouse.types'
export type {
  DocumentType,
  DocumentStatus,
  DocumentListItem,
  Document,
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
} from './document.types'
export type {
  AccountsPayableStatus,
  AccountsPayable,
  AccountsPayableDetail,
  AccountsPayableSupplier,
  AccountsPayableDocument,
  AccountsPayableMeta,
  PayablePayment,
  GetAccountsPayableParams,
  RegisterPayablePaymentPayload,
} from './accounts-payable.types'

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
