export type {
  AccountsReceivable,
  AccountsReceivableDetail,
  AccountsReceivableHistoryEntry,
  AccountsReceivableListMeta,
  AccountsReceivableListResponse,
  AccountsReceivableStatus,
  AccountsReceivableTotals,
  ClientBranchTotal,
  ClientCredit,
  ClientCreditApplication,
  ClientStatement,
  ClientStatementTotals,
  CustomerCreditKind,
  CustomerCreditRecord,
  CustomerCreditUsableIn,
  Excedente,
  ReceivableClient,
  ReceivableClientsResponse,
  ReceivableClientsSort,
  ReceivableClientsStatus,
  ReceivableClientSummary,
  ReceivableDocument,
  ReceivableDocumentRef,
} from '@contracts/accounts-receivable'
import type { ReceivableClientsSort, ReceivableClientsStatus } from '@contracts/accounts-receivable'

export interface GetReceivableClientsParams {
  page?: number
  limit?: number
  search?: string
  status?: ReceivableClientsStatus
  sort?: ReceivableClientsSort
  // Formato YYYY-MM-DD; filtra las facturas por document.date
  dateFrom?: string
  dateTo?: string
}

export interface CreateExcedentePayload {
  customerBranchId?: string
  amount: number
  // YYYY-MM-DD
  date?: string
}
