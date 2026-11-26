export type {
  SupplierPayment,
  SupplierPaymentAllocation,
  SupplierPaymentAllocationAccountPayable,
  SupplierPaymentCredit,
  SupplierPaymentCreditApplication,
  SupplierPaymentListItem,
  SupplierPaymentListMeta,
  SupplierPaymentListResponse,
  SupplierPaymentOpenItems,
  SupplierPaymentOpenPayable,
  SupplierPaymentMethodLine,
  TreasuryPaymentMethod,
  SupplierPaymentVoidReason,
} from '@contracts/supplier-payments'
import type { TreasuryPaymentMethod, SupplierPaymentVoidReason } from '@contracts/supplier-payments'

export const TREASURY_PAYMENT_METHOD_LABELS: Record<TreasuryPaymentMethod, string> = {
  efectivo_almacen: 'Efectivo almacén',
  consignacion_almacen: 'Consignación almacén',
  cheque: 'Cheque',
  efectivo_oficina: 'Efectivo oficina',
  consignacion_oficina: 'Consignación oficina',
}

export const SUPPLIER_PAYMENT_VOID_REASON_LABELS: Record<SupplierPaymentVoidReason, string> = {
  valor_equivocado: 'Valor equivocado',
  proveedor_equivocado: 'Proveedor equivocado',
  factura_equivocada: 'Factura equivocada',
  forma_pago_equivocada: 'Forma de pago equivocada',
  pago_duplicado: 'Pago duplicado',
  pago_no_realizado: 'Pago no realizado',
  otro: 'Otro',
}

export interface GetSupplierPaymentsParams {
  page?: number
  limit?: number
  supplierId?: string
  dateFrom?: string
  dateTo?: string
  number?: string
}

export interface CreateSupplierPaymentPayablePayload {
  accountPayableId: string
  amount: number
}

export interface CreateSupplierPaymentCreditPayload {
  supplierCreditId: string
  amount: number
}

export interface CreateSupplierPaymentMethodPayload {
  method: TreasuryPaymentMethod
  amount: number
  reference?: string
  bank?: string
}

export interface CreateSupplierPaymentPayload {
  supplierId: string
  date?: string
  notes?: string
  idempotencyKey: string
  payables: CreateSupplierPaymentPayablePayload[]
  credits?: CreateSupplierPaymentCreditPayload[]
  payments?: CreateSupplierPaymentMethodPayload[]
}
