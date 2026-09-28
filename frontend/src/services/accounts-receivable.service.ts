import { api } from './api'
import type {
  ApiResponse,
  AccountsReceivable,
  AccountsReceivableDetail,
  AccountsReceivableMeta,
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
