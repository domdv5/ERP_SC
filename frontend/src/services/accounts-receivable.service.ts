import { api } from './api'
import type {
  ApiResponse,
  AccountsReceivableDetail,
  AccountsReceivableMeta,
  ClientStatement,
  CreateExcedentePayload,
  ReceivableClientSummary,
  GetReceivableClientsParams,
} from '@/types'

export async function getReceivableClients(
  params?: GetReceivableClientsParams,
): Promise<{ items: ReceivableClientSummary[]; meta: AccountsReceivableMeta }> {
  const res = await api.get<
    ApiResponse<{ items: ReceivableClientSummary[]; meta: AccountsReceivableMeta }>
  >('/accounts-receivable/clients', { params })
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

export async function createExcedente(clientId: string, payload: CreateExcedentePayload) {
  const res = await api.post<ApiResponse<unknown>>(
    `/accounts-receivable/clients/${clientId}/excedentes`,
    payload,
  )
  return res.data.data
}

export async function voidExcedente(id: string) {
  const res = await api.patch<ApiResponse<unknown>>(`/accounts-receivable/excedentes/${id}/void`)
  return res.data.data
}
