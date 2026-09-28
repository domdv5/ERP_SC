import type { DocumentType } from './document.types'
import type { AccountsReceivableStatus } from './recibo-caja.types'

export interface AccountsReceivableClient {
  id: string
  thirdParty: {
    id: string
    name: string
  }
}

export interface AccountsReceivableSeller {
  id: string
  name: string
}

export interface AccountsReceivableDocument {
  id: string
  type: DocumentType
  // El backend ya lo manda con ceros a la izquierda (ej. "000009"); pasa por docNumber() igual.
  number: string
  date: string
}

// Decimal de Prisma llega como string en el JSON; se tipa `string` a propósito para no mentir que ya es number.
export interface AccountsReceivable {
  id: string
  clientId: string
  sellerId: string | null
  documentId: string
  totalAmount: string
  dueDate: string | null
  status: AccountsReceivableStatus
  createdAt: string
  updatedAt: string
  client: AccountsReceivableClient
  seller: AccountsReceivableSeller | null
  document: AccountsReceivableDocument
  paidAmount: string
  // Derivado: totalAmount - paidAmount
  balance: string
}

// Fila del historial de abonos de una CxC, discriminada por `source`. Sin equivalente a saldo a
// favor de proveedor: el saldo a favor de cliente (CustomerCredit) es un flujo distinto (DVV).
export type AccountsReceivableHistoryEntry =
  | {
      source: 'recibo_caja'
      date: string
      amount: string
      reciboCaja: { id: string; number: string; date: string }
    }
  | {
      source: 'pago_historico'
      date: string
      amount: string
      paymentMethod: string
      reference: string | null
    }

export interface AccountsReceivableDetail extends AccountsReceivable {
  history: AccountsReceivableHistoryEntry[]
}

// Suma sobre TODO el conjunto que matchea los filtros activos (no solo la página visible).
export interface AccountsReceivableTotals {
  totalAmount: string
  paidAmount: string
  balance: string
}

export interface AccountsReceivableMeta {
  total: number
  page: number
  limit: number
  totalPages: number
  totals: AccountsReceivableTotals
}

export interface GetAccountsReceivableParams {
  page?: number
  limit?: number
  status?: AccountsReceivableStatus
  clientId?: string
  search?: string
  // Formato YYYY-MM-DD (el que da un <input type="date">); filtra sobre document.date
  dateFrom?: string
  dateTo?: string
}
