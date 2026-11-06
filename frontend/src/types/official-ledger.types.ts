export type {
  OfficialLedgerItem,
  OfficialLedgerListResponse,
  OfficialLedgerMeta,
  OfficialLedgerMovement,
  OfficialLedgerProductDetail,
  OfficialLedgerTotals,
} from '@contracts/official-ledger'

export interface GetOfficialLedgerParams {
  page?: number
  limit?: number
  search?: string
  dateFrom?: string
  dateTo?: string
}

export interface GetOfficialLedgerMovementsParams {
  dateFrom?: string
  dateTo?: string
}
