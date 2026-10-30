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
  // Solo lo mandan las cuentas por pagar (no egresos); null en compras anteriores a este campo.
  receiver?: { id: string; name: string } | null
}

// Decimal de Prisma llega como string en el JSON; se tipa `string` a propósito para no mentir que ya es number.
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

// Fila del historial de pagos de una CxP, discriminada por `source`; `nota_credito_historica` son pagos con notas crédito aplicadas a mano.
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

// Suma sobre TODO el conjunto que matchea los filtros activos (no solo la página visible).
export interface AccountsPayableTotals {
  totalAmount: string
  paidAmount: string
  balance: string
}

export interface AccountsPayableMeta {
  total: number
  page: number
  limit: number
  totalPages: number
  totals: AccountsPayableTotals
}

export type PayableSuppliersStatus = 'with_balance' | 'settled'

export type PayableSuppliersSort = 'recent' | 'oldest_debt'

export interface GetPayableSuppliersParams {
  page?: number
  limit?: number
  search?: string
  status?: PayableSuppliersStatus
  sort?: PayableSuppliersSort
  // Formato YYYY-MM-DD; filtra las facturas por document.date
  dateFrom?: string
  dateTo?: string
}

// Una fila por proveedor, agregada sobre todas sus CxP.
export interface PayableSupplierSummary {
  supplier: { id: string; name: string }
  payableCount: number
  totalAmount: string
  paidAmount: string
  balance: string
  lastPurchaseDate: string
  lastPaymentDate: string | null
  lastMovementAt: string
  // Días desde la factura más antigua con saldo; null si no se le debe nada
  oldestPendingDays: number | null
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
