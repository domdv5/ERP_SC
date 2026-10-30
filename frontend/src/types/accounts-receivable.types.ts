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
  // Solo ventas de clientes con sucursales.
  customerBranch?: { id: string; name: string } | null
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
  // Derivados: fecha del último pago (null si no hay pagos) y días de la venta al pago final, o hasta hoy si sigue abierta
  lastPaymentDate: string | null
  paymentDays: number
  isPaymentOpen: boolean
}

// Fila del historial de abonos de una CxC, discriminada por `source`. Sin equivalente a saldo a
// favor de proveedor: el saldo a favor de cliente (CustomerCredit) es un flujo distinto (DVV).
export type AccountsReceivableHistoryEntry =
  | {
      source: 'recibo_caja'
      date: string
      // Incluido en `amount`: parte del abono cubierta por descuento del recibo.
      discountAmount: string
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

export type ReceivableClientsStatus = 'with_balance' | 'settled'

export type ReceivableClientsSort = 'recent' | 'oldest_debt'

export interface GetReceivableClientsParams {
  page?: number
  limit?: number
  search?: string
  status?: ReceivableClientsStatus
  sort?: ReceivableClientsSort
  // Formato YYYY-MM-DD; filtra las facturas por document.date
  dateFrom?: string
  dateTo?: string
}

// Una fila por cliente, agregada sobre todas sus CxC.
export interface ReceivableClientSummary {
  client: { id: string; name: string }
  receivableCount: number
  totalAmount: string
  paidAmount: string
  balance: string
  lastSaleDate: string
  lastPaymentDate: string | null
  lastMovementAt: string
  // Días desde la factura más antigua con saldo; null si no debe nada
  oldestPendingDays: number | null
}

export interface ClientStatementTotals {
  totalDebt: string
  totalPaid: string
  totalBalance: string
  availableCredit: string
}

export interface ClientCreditApplication {
  id: string
  amount: string
  appliedAt: string
  saleDocument: AccountsReceivableDocument
}

export interface ClientCredit {
  id: string
  amount: string
  balance: string
  status: 'available' | 'used'
  createdAt: string
  sourceDocument: AccountsReceivableDocument | null
  applications: ClientCreditApplication[]
}

// branchId null = CxC sin sucursal. Se calcula sobre todas las CxC del cliente, sin importar el filtro.
export interface ClientBranchTotal {
  branchId: string | null
  name: string
  totalDebt: string
  totalPaid: string
  totalBalance: string
}

export interface ClientStatement {
  client: { id: string; name: string }
  totals: ClientStatementTotals
  branchTotals: ClientBranchTotal[]
  receivables: AccountsReceivable[]
  credits: ClientCredit[]
}
