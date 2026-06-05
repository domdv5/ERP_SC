export type PersonType = 'natural' | 'juridica'
export type DocumentType = 'CC' | 'NIT' | 'CE' | 'PAS' | 'TI' | 'RC'

export interface Customer {
  id: string
  creditLimit?: number
  discount?: number
  sellerId?: string
}

export interface Supplier {
  id: string
  internalNumber: number
  brands: { id: string; name: string }[]
}

export interface ThirdParty {
  id: string
  name: string
  personType: PersonType
  documentType: DocumentType
  documentNumber: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  isSeller?: boolean
  isCustomer?: boolean
  isSupplier?: boolean
  isActive: boolean
  customer?: Customer | null
  supplier?: Supplier | null
  createdAt: string
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
  isSeller?: boolean
  isCustomer?: boolean
  isSupplier?: boolean
  creditLimit?: number
  discount?: number
  sellerId?: string
  internalNumber?: number
  brands?: string[]
}

export type UpdateThirdPartyPayload = Partial<CreateThirdPartyPayload>
