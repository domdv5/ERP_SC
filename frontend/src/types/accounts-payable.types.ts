import type { DocumentType } from './document.types'

export type AccountsPayableStatus = 'pending' | 'partial' | 'paid'

export interface AccountsPayableSupplier {
  id: string
  internalNumber: number
  discountNotes: string | null
  thirdParty: {
    id: string
    name: string
  }
}

export interface AccountsPayableDocument {
  id: string
  type: DocumentType
  // El backend ya lo manda con ceros a la izquierda (ej. "000009"); pasa por docNumber() igual.
  number: string
  date: string
}

// Los campos Decimal de Prisma (totalAmount, paidAmount, creditApplied, balance) llegan como
// string en el JSON — se tipan `string` a propósito (no `number`) para que TypeScript avise si
// algún consumidor los usa sin pasarlos por Number() primero, en vez de mentir que ya son number.
export interface AccountsPayable {
  id: string
  supplierId: string
  documentId: string
  totalAmount: string
  dueDate: string | null
  status: AccountsPayableStatus
  createdAt: string
  updatedAt: string
  supplier: AccountsPayableSupplier
  document: AccountsPayableDocument
  // Dinero + saldo a favor ya aplicados, y lo que falta (= totalAmount − paidAmount).
  paidAmount: string
  creditApplied: string
  balance: string
}

/** Saldo a favor de un proveedor (originado por una devolución) que se reparte entre sus CxP al pagar un Egreso. */
export interface SupplierCredit {
  id: string
  supplierId: string
  amount: string
  balance: string
  sourceDocumentId: string | null
  status: 'available' | 'used'
  createdAt: string
  sourceDocument?: AccountsPayableDocument
}

// Una fila del historial de pagos de una CxP, discriminada por `source`. `nota_credito_historica`
// es el historial previo al rework de Egresos (un pago viejo con notas crédito aplicadas a mano).
export type AccountsPayableHistoryEntry =
  | {
      source: 'egreso'
      date: string
      amount: string
      creditAmount: string
      egreso: { id: string; number: string; date: string }
    }
  | {
      source: 'pago_historico'
      date: string
      amount: string
      paymentMethod: string
      bankDestination: string | null
      reference: string | null
    }
  | {
      source: 'nota_credito_historica'
      date: string
      amount: string
      supplierCredit: { id: string; amount: string; balance: string }
    }

export interface AccountsPayableDetail extends AccountsPayable {
  history: AccountsPayableHistoryEntry[]
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

export interface SupplierStatementTotals {
  totalDebt: string
  totalPaid: string
  totalBalance: string
  availableCredit: string
}

export interface SupplierCreditApplicationWithEgreso {
  id: string
  supplierCreditId: string
  accountPayableId: string
  egresoId: string | null
  amount: string
  appliedAt: string
  egreso: { id: string; number: string; date: string } | null
}

export interface SupplierCreditWithApplications extends SupplierCredit {
  applications: SupplierCreditApplicationWithEgreso[]
}

export interface SupplierStatement {
  supplier: { id: string; name: string }
  totals: SupplierStatementTotals
  payables: AccountsPayable[]
  credits: SupplierCreditWithApplications[]
}
