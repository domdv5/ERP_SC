export type {
  Egreso,
  EgresoAllocation,
  EgresoAllocationAccountPayable,
  EgresoCredit,
  EgresoCreditApplication,
  EgresoListItem,
  EgresoListMeta,
  EgresoListResponse,
  EgresoOpenItems,
  EgresoOpenPayable,
  EgresoPaymentLine,
  EgresoPaymentMethod,
} from '@contracts/egresos'
import type { EgresoPaymentMethod } from '@contracts/egresos'

export const EGRESO_PAYMENT_METHOD_LABELS: Record<EgresoPaymentMethod, string> = {
  efectivo_almacen: 'Efectivo almacén',
  consignacion_almacen: 'Consignación almacén',
  cheque: 'Cheque',
  efectivo_oficina: 'Efectivo oficina',
  consignacion_oficina: 'Consignación oficina',
}

export interface GetEgresosParams {
  page?: number
  limit?: number
  supplierId?: string
  dateFrom?: string
  dateTo?: string
  number?: string
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
