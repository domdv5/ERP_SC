import { api } from './api'
import type {
  ApiResponse,
  SupplierPayment,
  SupplierPaymentListResponse,
  GetSupplierPaymentsParams,
  SupplierPaymentOpenItems,
  CreateSupplierPaymentPayload,
  SupplierPaymentVoidReason,
} from '@/types'

export async function getSupplierPayments(
  params?: GetSupplierPaymentsParams,
): Promise<SupplierPaymentListResponse> {
  const res = await api.get<ApiResponse<SupplierPaymentListResponse>>('/supplier-payments', {
    params,
  })
  return res.data.data
}

export async function getSupplierPayment(id: string): Promise<SupplierPayment> {
  const res = await api.get<ApiResponse<SupplierPayment>>(`/supplier-payments/${id}`)
  return res.data.data
}

/** CxP abiertas y saldos a favor disponibles de un proveedor, para armar un nuevo egreso. */
export async function getSupplierPaymentOpenItems(
  supplierId: string,
): Promise<SupplierPaymentOpenItems> {
  const res = await api.get<ApiResponse<SupplierPaymentOpenItems>>(
    `/supplier-payments/suppliers/${supplierId}/open-items`,
  )
  return res.data.data
}

export async function createSupplierPayment(
  payload: CreateSupplierPaymentPayload,
): Promise<SupplierPayment> {
  const res = await api.post<ApiResponse<SupplierPayment>>('/supplier-payments', payload)
  return res.data.data
}

export async function voidSupplierPayment(
  id: string,
  reason: SupplierPaymentVoidReason,
  reasonOther?: string,
): Promise<SupplierPayment> {
  const res = await api.post<ApiResponse<SupplierPayment>>(`/supplier-payments/${id}/void`, {
    reason,
    reasonOther,
  })
  return res.data.data
}
