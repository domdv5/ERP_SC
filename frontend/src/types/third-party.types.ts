export type {
  CityWithDepartment,
  Customer,
  CustomerBranch,
  CustomerBranchWithCity,
  CustomerDetail,
  Supplier,
  SupplierBrand,
  SupplierDetail,
  TaxRegime,
  ThirdPartyCreated,
  ThirdPartyDetail,
  ThirdPartyListMeta,
  ThirdPartyListResponse,
  ThirdPartyRecord,
  WithholdingAgentType,
} from '@contracts/third-parties'
import type { TaxRegime, WithholdingAgentType } from '@contracts/third-parties'

// El contrato manda personType/documentType como string; estas son las uniones que acepta el formulario.
export type PersonType = 'natural' | 'juridica'
export type DocumentType = 'CC' | 'NIT' | 'CE' | 'PAS' | 'TI' | 'RC'

export interface CustomerBranchInput {
  name: string
  address?: string
  cityCode?: string
  phone?: string
}

export interface CreateThirdPartyPayload {
  name: string
  personType: PersonType
  documentType: DocumentType
  documentNumber: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  cityCode?: string | null
  ivaResponsible?: boolean | null
  withholdingAgentType?: WithholdingAgentType | null
  taxRegime?: TaxRegime | null
  isSeller?: boolean
  isReceiver?: boolean
  isCustomer?: boolean
  isSupplier?: boolean
  creditLimit?: number
  discount?: number
  sellerId?: string
  internalNumber?: number
  discountNotes?: string
  brands?: string[]
  branches?: CustomerBranchInput[]
}

export type UpdateThirdPartyPayload = Partial<CreateThirdPartyPayload>
