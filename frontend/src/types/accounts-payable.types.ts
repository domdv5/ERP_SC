export type {
  AccountsPayable,
  AccountsPayableDetail,
  AccountsPayableHistoryEntry,
  AccountsPayableListMeta,
  AccountsPayableListResponse,
  AccountsPayableStatus,
  AccountsPayableTotals,
  PayableDocument,
  PayableDocumentRef,
  PayableSupplier,
  PayableSuppliersResponse,
  PayableSuppliersSort,
  PayableSuppliersStatus,
  PayableSupplierSummary,
  SupplierCredit,
  SupplierCreditApplication,
  SupplierCreditWithApplications,
  SupplierStatement,
  SupplierStatementTotals,
} from '@contracts/accounts-payable'
import type { PayableSuppliersSort, PayableSuppliersStatus } from '@contracts/accounts-payable'

export interface GetPayableSuppliersParams {
  page?: number
  limit?: number
  search?: string
  status?: PayableSuppliersStatus
  sort?: PayableSuppliersSort
  // Formato YYYY-MM-DD; filtra las facturas por document.date
  dateFrom?: string
  dateTo?: string
}
