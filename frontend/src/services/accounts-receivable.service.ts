import { api } from './api'
import type {
  ApiResponse,
  AccountsReceivable,
  AccountsReceivableDetail,
  AccountsReceivableMeta,
  ClientStatement,
  GetAccountsReceivableParams,
} from '@/types'

export async function getAccountsReceivable(
  params?: GetAccountsReceivableParams,
): Promise<{ items: AccountsReceivable[]; meta: AccountsReceivableMeta }> {
  const res = await api.get<
    ApiResponse<{ items: AccountsReceivable[]; meta: AccountsReceivableMeta }>
  >('/accounts-receivable', { params })
  return res.data.data
}

export async function getAccountReceivable(id: string): Promise<AccountsReceivableDetail> {
  const res = await api.get<ApiResponse<AccountsReceivableDetail>>(`/accounts-receivable/${id}`)
  return res.data.data
}

export async function getClientStatement(clientId: string): Promise<ClientStatement> {
  const res = await api.get<ApiResponse<ClientStatement>>(
    `/accounts-receivable/clients/${clientId}/statement`,
  )
  return res.data.data
}
