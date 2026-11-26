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
  ReciboCajaVoidReason,
} from '@contracts/recibos-caja'
import type { ReciboCajaDiscountReason, ReciboCajaVoidReason } from '@contracts/recibos-caja'
// Reusa las formas de pago de Egresos (regla de negocio del backend)
import type { TreasuryPaymentMethod } from '@contracts/supplier-payments'

export const RECIBO_CAJA_VOID_REASON_LABELS: Record<ReciboCajaVoidReason, string> = {
  valor_equivocado: 'Valor equivocado',
  cliente_equivocado: 'Cliente equivocado',
  factura_equivocada: 'Factura equivocada',
  forma_pago_equivocada: 'Forma de pago equivocada',
  pago_duplicado: 'Pago duplicado',
  pago_no_recibido: 'Pago no recibido',
  otro: 'Otro',
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

export interface CreateReciboCajaReceivablePayload {
  accountReceivableId: string
  amount: number
}

export interface CreateReciboCajaPaymentPayload {
  method: TreasuryPaymentMethod
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
