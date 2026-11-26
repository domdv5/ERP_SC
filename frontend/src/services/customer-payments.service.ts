import { api } from './api'
import type {
  ApiResponse,
  CustomerPayment,
  CustomerPaymentListResponse,
  GetCustomerPaymentsParams,
  CustomerPaymentOpenItems,
  CreateCustomerPaymentPayload,
  CustomerPaymentVoidReason,
} from '@/types'

export async function getCustomerPayments(
  params?: GetCustomerPaymentsParams,
): Promise<CustomerPaymentListResponse> {
  const res = await api.get<ApiResponse<CustomerPaymentListResponse>>('/customer-payments', {
    params,
  })
  return res.data.data
}

export async function getCustomerPayment(id: string): Promise<CustomerPayment> {
  const res = await api.get<ApiResponse<CustomerPayment>>(`/customer-payments/${id}`)
  return res.data.data
}

/** CxC abiertas de un cliente; `customerBranchId` = id de sucursal o 'none' (facturas sin sucursal). */
export async function getCustomerPaymentOpenItems(
  clientId: string,
  customerBranchId?: string,
): Promise<CustomerPaymentOpenItems> {
  const res = await api.get<ApiResponse<CustomerPaymentOpenItems>>(
    `/customer-payments/clients/${clientId}/open-items`,
    { params: customerBranchId ? { customerBranchId } : undefined },
  )
  return res.data.data
}

export async function createCustomerPayment(
  payload: CreateCustomerPaymentPayload,
): Promise<CustomerPayment> {
  const res = await api.post<ApiResponse<CustomerPayment>>('/customer-payments', payload)
  return res.data.data
}

export async function voidCustomerPayment(
  id: string,
  reason: CustomerPaymentVoidReason,
  reasonOther?: string,
): Promise<CustomerPayment> {
  const res = await api.post<ApiResponse<CustomerPayment>>(`/customer-payments/${id}/void`, {
    reason,
    reasonOther,
  })
  return res.data.data
}
