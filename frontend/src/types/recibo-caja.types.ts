export type {
  ReciboCaja,
  ReciboCajaAllocation,
  ReciboCajaAllocationAccountReceivable,
  ReciboCajaBranch,
  ReciboCajaCreditApplication,
  ReciboCajaDiscountReason,
  ReciboCajaListItem,
  ReciboCajaListMeta,
  ReciboCajaListResponse,
  ReciboCajaOpenCredit,
  ReciboCajaOpenItems,
  ReciboCajaOpenReceivable,
  ReciboCajaPaymentLine,
} from '@contracts/recibos-caja'
import type { ReciboCajaDiscountReason } from '@contracts/recibos-caja'
// Reusa las formas de pago de Egresos (regla de negocio del backend)
import type { EgresoPaymentMethod } from '@contracts/egresos'

export interface GetRecibosCajaParams {
  page?: number
  limit?: number
  clientId?: string
  customerBranchId?: string
  dateFrom?: string
  dateTo?: string
  number?: string
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

export interface CreateReciboCajaCreditPayload {
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
  credits?: CreateReciboCajaCreditPayload[]
}
