import type { DocumentType } from './document.types'
import type {
  AccountsPayableDocument,
  AccountsPayableStatus,
  AccountsPayableSupplier,
} from './accounts-payable.types'

export type EgresoPaymentMethod =
  | 'efectivo_almacen'
  | 'consignacion_almacen'
  | 'cheque'
  | 'efectivo_oficina'
  | 'consignacion_oficina'

export const EGRESO_PAYMENT_METHOD_LABELS: Record<EgresoPaymentMethod, string> = {
  efectivo_almacen: 'Efectivo almacén',
  consignacion_almacen: 'Consignación almacén',
  cheque: 'Cheque',
  efectivo_oficina: 'Efectivo oficina',
  consignacion_oficina: 'Consignación oficina',
}

// Campos Decimal de Prisma tipados `string` a propósito: llegan como string del backend
export interface EgresoListItem {
  id: string
  number: string
  date: string
  total: string
  cashTotal: string
  creditTotal: string
  createdAt: string
  supplier: AccountsPayableSupplier
}

export interface EgresoPaymentLine {
  id: string
  egresoId: string
  method: EgresoPaymentMethod
  amount: string
  reference: string | null
  bank: string | null
  createdAt: string
}

// Sin `supplier` (el egreso ya es de un proveedor) ni `creditApplied`/`balance` (eso vive a nivel de CxP)
export interface EgresoAllocationAccountPayable {
  id: string
  supplierId: string
  documentId: string
  totalAmount: string
  paidAmount: string
  dueDate: string | null
  status: AccountsPayableStatus
  createdAt: string
  updatedAt: string
  document: AccountsPayableDocument
}

export interface EgresoAllocation {
  id: string
  egresoId: string
  accountPayableId: string
  // Total abonado a esa CxP con este egreso (dinero + saldo a favor).
  amount: string
  // Parte de `amount` cubierta con saldo a favor (reparto FIFO que hace el backend).
  creditAmount: string
  accountPayable: EgresoAllocationAccountPayable
}

export interface EgresoCreditApplication {
  id: string
  supplierCreditId: string
  accountPayableId: string
  egresoId: string
  amount: string
  appliedAt: string
  supplierCredit: {
    id: string
    supplierId: string
    amount: string
    balance: string
    sourceDocumentId: string | null
    status: 'available' | 'used'
    createdAt: string
    sourceDocument: { id: string; type: DocumentType; number: string; date: string }
  }
}

export interface Egreso {
  id: string
  number: string
  date: string
  supplierId: string
  userId: string
  total: string
  cashTotal: string
  creditTotal: string
  notes: string | null
  idempotencyKey: string
  createdAt: string
  supplier: AccountsPayableSupplier
  user: { id: string; name: string }
  payments: EgresoPaymentLine[]
  allocations: EgresoAllocation[]
  creditApplications: EgresoCreditApplication[]
}

export interface EgresoMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface GetEgresosParams {
  page?: number
  limit?: number
  supplierId?: string
  dateFrom?: string
  dateTo?: string
  number?: string
}

// Ya trae `balance` calculado, ordenadas createdAt asc (mismo orden del reparto FIFO del backend)
export interface EgresoOpenPayable {
  id: string
  supplierId: string
  documentId: string
  totalAmount: string
  paidAmount: string
  dueDate: string | null
  status: AccountsPayableStatus
  createdAt: string
  updatedAt: string
  document: AccountsPayableDocument
  balance: string
}

export interface EgresoOpenCredit {
  id: string
  supplierId: string
  amount: string
  balance: string
  sourceDocumentId: string | null
  status: 'available' | 'used'
  createdAt: string
  sourceDocument: { id: string; type: DocumentType; number: string; date: string }
}

export interface EgresoOpenItems {
  payables: EgresoOpenPayable[]
  credits: EgresoOpenCredit[]
}

export interface CreateEgresoPayablePayload {
  accountPayableId: string
  amount: number
}

export interface CreateEgresoCreditPayload {
  supplierCreditId: string
  amount: number
}

export interface CreateEgresoPaymentPayload {
  method: EgresoPaymentMethod
  amount: number
  reference?: string
  bank?: string
}

export interface CreateEgresoPayload {
  supplierId: string
  date?: string
  notes?: string
  idempotencyKey: string
  payables: CreateEgresoPayablePayload[]
  credits?: CreateEgresoCreditPayload[]
  payments?: CreateEgresoPaymentPayload[]
}
