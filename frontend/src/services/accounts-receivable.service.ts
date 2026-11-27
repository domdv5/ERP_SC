import { api } from './api'
import type {
  ApiResponse,
  AccountsReceivableDetail,
  ClientStatement,
  ReceivableClientsResponse,
  GetReceivableClientsParams,
} from '@/types'

export async function getReceivableClients(
  params?: GetReceivableClientsParams,
): Promise<ReceivableClientsResponse> {
  const res = await api.get<ApiResponse<ReceivableClientsResponse>>(
    '/accounts-receivable/clients',
    { params },
  )
  return res.data.data
}

export async function getAccountReceivable(id: string): Promise<AccountsReceivableDetail> {
  const res = await api.get<ApiResponse<AccountsReceivableDetail>>(`/accounts-receivable/${id}`)
  return res.data.data
}

export async function getClientStatement(
  clientId: string,
  customerBranchId?: string,
): Promise<ClientStatement> {
  const res = await api.get<ApiResponse<ClientStatement>>(
    `/accounts-receivable/clients/${clientId}/statement`,
    { params: { customerBranchId } },
  )
  return res.data.data
}
