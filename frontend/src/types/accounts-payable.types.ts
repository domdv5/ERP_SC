import type { DocumentType } from './document.types'

export type AccountsPayableStatus = 'pending' | 'partial' | 'paid'

export interface AccountsPayableSupplier {
  id: string
  thirdPartyId: string
  thirdParty: {
    id: string
    name: string
  }
}

export interface AccountsPayableDocument {
  id: string
  type: DocumentType
  number: number
  date: string
}

export interface PayablePayment {
  id: string
  accountPayableId: string
  amount: number
  paymentDate: string
  paymentMethod: string
  bankDestination: string | null
  reference: string | null
  createdAt: string
}

export interface AccountsPayable {
  id: string
  supplierId: string
  documentId: string
  totalAmount: number
  dueDate: string | null
  status: AccountsPayableStatus
  createdAt: string
  updatedAt: string
  supplier: AccountsPayableSupplier
  document: AccountsPayableDocument
}

export interface AccountsPayableDetail extends AccountsPayable {
  payablePayments: PayablePayment[]
}

export interface AccountsPayableMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface GetAccountsPayableParams {
  page?: number
  limit?: number
  status?: AccountsPayableStatus
  supplierId?: string
  search?: string
}

export interface RegisterPayablePaymentPayload {
  amount: number
  paymentDate?: string
  paymentMethod: string
  bankDestination?: string
  reference?: string
}
