export type {
  CustomerPayment,
  CustomerPaymentAllocation,
  CustomerPaymentAllocationAccountReceivable,
  CustomerPaymentBranch,
  CustomerPaymentCreditApplication,
  CustomerPaymentDiscountReason,
  CustomerPaymentListItem,
  CustomerPaymentListMeta,
  CustomerPaymentListResponse,
  CustomerPaymentOpenCredit,
  CustomerPaymentOpenItems,
  CustomerPaymentOpenReceivable,
  CustomerPaymentMethodLine,
  CustomerPaymentVoidReason,
} from '@contracts/customer-payments'
import type {
  CustomerPaymentDiscountReason,
  CustomerPaymentVoidReason,
} from '@contracts/customer-payments'
// Reusa las formas de pago de Egresos (regla de negocio del backend)
import type { TreasuryPaymentMethod } from '@contracts/supplier-payments'

export const CUSTOMER_PAYMENT_VOID_REASON_LABELS: Record<CustomerPaymentVoidReason, string> = {
  valor_equivocado: 'Valor equivocado',
  cliente_equivocado: 'Cliente equivocado',
  factura_equivocada: 'Factura equivocada',
  forma_pago_equivocada: 'Forma de pago equivocada',
  pago_duplicado: 'Pago duplicado',
  pago_no_recibido: 'Pago no recibido',
  otro: 'Otro',
}

export interface GetCustomerPaymentsParams {
  page?: number
  limit?: number
  clientId?: string
  customerBranchId?: string
  dateFrom?: string
  dateTo?: string
  number?: string
}

export interface CreateCustomerPaymentReceivablePayload {
  accountReceivableId: string
  amount: number
}

export interface CreateCustomerPaymentMethodPayload {
  method: TreasuryPaymentMethod
  amount: number
  reference?: string
  bank?: string
}

export interface CreateCustomerPaymentCreditPayload {
  customerCreditId: string
  amount: number
}

export interface CreateCustomerPaymentPayload {
  clientId: string
  customerBranchId?: string
  date?: string
  notes?: string
  idempotencyKey: string
  receivables: CreateCustomerPaymentReceivablePayload[]
  payments?: CreateCustomerPaymentMethodPayload[]
  discount?: { reason: CustomerPaymentDiscountReason; amount: number }
  credits?: CreateCustomerPaymentCreditPayload[]
}
