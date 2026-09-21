import { api } from './api'
import type {
  ApiResponse,
  AccountsPayable,
  AccountsPayableDetail,
  AccountsPayableMeta,
  GetAccountsPayableParams,
  SupplierStatement,
} from '@/types'

export async function getAccountsPayable(
  params?: GetAccountsPayableParams,
): Promise<{ items: AccountsPayable[]; meta: AccountsPayableMeta }> {
  const res = await api.get<ApiResponse<{ items: AccountsPayable[]; meta: AccountsPayableMeta }>>(
    '/accounts-payable',
    { params },
  )
  return res.data.data
}

export async function getAccountPayable(id: string): Promise<AccountsPayableDetail> {
  const res = await api.get<ApiResponse<AccountsPayableDetail>>(`/accounts-payable/${id}`)
  return res.data.data
}

/** Estado de cuenta de un proveedor: totales, sus CxP y sus saldos a favor con sus aplicaciones. */
export async function getSupplierStatement(supplierId: string): Promise<SupplierStatement> {
  const res = await api.get<ApiResponse<SupplierStatement>>(
    `/accounts-payable/suppliers/${supplierId}/statement`,
  )
  return res.data.data
}
