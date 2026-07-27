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

/** Saldo a favor de un proveedor (originado por una devolución DVC) aplicable manualmente a cualquier cuenta por pagar suya. Ver plan 020. */
export interface SupplierCredit {
  id: string
  supplierId: string
  amount: number
  balance: number
  sourceDocumentId: string | null
  status: 'available' | 'used'
  createdAt: string
}

/** Registro de auditoría de una aplicación de crédito contra una cuenta por pagar específica. */
export interface SupplierCreditApplication {
  id: string
  supplierCreditId: string
  accountPayableId: string
  amount: number
  appliedAt: string
}

export interface AccountsPayableDetail extends AccountsPayable {
  payablePayments: PayablePayment[]
  // Opcional porque el backend puede no incluirlo aún en todas las respuestas — el detalle se degrada a "sin aplicaciones" si falta.
  creditApplications?: SupplierCreditApplication[]
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

export interface CreditApplicationPayload {
  supplierCreditId: string
  amount: number
}

export interface RegisterPayablePaymentPayload {
  amount: number
  paymentDate?: string
  paymentMethod: string
  bankDestination?: string
  reference?: string
  creditApplications?: CreditApplicationPayload[]
}
