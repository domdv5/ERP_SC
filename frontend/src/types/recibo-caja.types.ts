import type { DocumentType } from './document.types'
// Reusa el mismo enum de Egresos: "las mismas formas de pago que ya existen y se utilizan en los egresos" (regla de negocio explícita del backend)
import type { EgresoPaymentMethod } from './egreso.types'

export type ReciboCajaDiscountReason =
  | 'descuento_comercial'
  | 'oferta'
  | 'donacion'
  | 'fidelizacion'
  | 'mercancia_extraviada'
  | 'castigo_cartera'
  | 'promocion'

export type AccountsReceivableStatus = 'pending' | 'partial' | 'paid'

export interface ReciboCajaClient {
  id: string
  thirdParty: {
    id: string
    name: string
  }
}

export interface ReciboCajaBranch {
  id: string
  name: string
}

export interface ReciboCajaDocument {
  id: string
  type: DocumentType
  // El backend ya lo manda con ceros a la izquierda (ej. "000009"); pasa por docNumber() igual.
  number: string
  date: string
  customerBranch?: ReciboCajaBranch | null
}

// Campos Decimal de Prisma tipados `string` a propósito: llegan como string del backend
export interface ReciboCajaListItem {
  id: string
  number: string
  date: string
  total: string
  createdAt: string
  client: ReciboCajaClient
  customerBranch: ReciboCajaBranch | null
}

export interface ReciboCajaPaymentLine {
  id: string
  reciboCajaId: string
  method: EgresoPaymentMethod
  amount: string
  reference: string | null
  bank: string | null
  createdAt: string
}

// Sin `client` (el recibo ya es de un cliente) ni `balance` (eso vive a nivel de CxC)
export interface ReciboCajaAllocationAccountReceivable {
  id: string
  clientId: string
  documentId: string
  totalAmount: string
  paidAmount: string
  dueDate: string | null
  status: AccountsReceivableStatus
  createdAt: string
  updatedAt: string
  document: ReciboCajaDocument
}

// Sin `creditAmount`: este flujo no aplica saldo a favor (regla de negocio explícita, ver RecibosCajaModule)
export interface ReciboCajaAllocation {
  id: string
  reciboCajaId: string
  accountReceivableId: string
  amount: string
  discountAmount: string
  accountReceivable: ReciboCajaAllocationAccountReceivable
}

// Excedente del cliente usado como parte del pago de este recibo
export interface ReciboCajaCreditApplication {
  id: string
  amount: string
  customerCreditId: string
  customerCredit: { id: string; date: string; amount: string }
}

export interface ReciboCaja {
  id: string
  number: string
  date: string
  clientId: string
  userId: string
  total: string
  discountAmount: string
  discountReason: ReciboCajaDiscountReason | null
  debtBeforeReceipt: string | null
  notes: string | null
  idempotencyKey: string
  createdAt: string
  client: ReciboCajaClient
  customerBranch: ReciboCajaBranch | null
  user: { id: string; name: string }
  payments: ReciboCajaPaymentLine[]
  allocations: ReciboCajaAllocation[]
  creditApplications: ReciboCajaCreditApplication[]
}

export interface ReciboCajaMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface GetRecibosCajaParams {
  page?: number
  limit?: number
  clientId?: string
  customerBranchId?: string
  dateFrom?: string
  dateTo?: string
  number?: string
}

// Ya trae `balance` calculado, ordenadas createdAt asc
export interface ReciboCajaOpenReceivable {
  id: string
  clientId: string
  documentId: string
  totalAmount: string
  paidAmount: string
  dueDate: string | null
  status: AccountsReceivableStatus
  createdAt: string
  updatedAt: string
  document: ReciboCajaDocument
  balance: string
}

// Excedente disponible de la misma sucursal; `balance` ya descuenta lo usado
export interface ReciboCajaOpenExcedente {
  id: string
  amount: string
  balance: string
  date: string
  customerBranchId: string | null
}

export interface ReciboCajaOpenItems {
  receivables: ReciboCajaOpenReceivable[]
  excedentes: ReciboCajaOpenExcedente[]
}

export interface CreateReciboCajaReceivablePayload {
  accountReceivableId: string
  amount: number
}

export interface CreateReciboCajaPaymentPayload {
  method: EgresoPaymentMethod
  amount: number
  reference?: string
  bank?: string
}

export interface CreateReciboCajaExcedentePayload {
  customerCreditId: string
  amount: number
}

export interface CreateReciboCajaPayload {
  clientId: string
  customerBranchId?: string
  date?: string
  notes?: string
  idempotencyKey: string
  receivables: CreateReciboCajaReceivablePayload[]
  payments?: CreateReciboCajaPaymentPayload[]
  discount?: { reason: ReciboCajaDiscountReason; amount: number }
  excedentes?: CreateReciboCajaExcedentePayload[]
}
