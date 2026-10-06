export interface OfficialLedgerItem {
  productId: string
  code: string
  name: string
  openingBalance: number
  purchased: number
  sold: number
  closingBalance: number
}

export interface OfficialLedgerTotals {
  openingBalance: number
  purchased: number
  sold: number
  closingBalance: number
}

export interface OfficialLedgerMeta {
  total: number
  page: number
  limit: number
  totalPages: number
  // Suma sobre todo el conjunto filtrado, no solo la página visible.
  totals: OfficialLedgerTotals
}

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

// CMO suma (cantidad positiva), POSO resta (cantidad negativa).
export interface OfficialLedgerMovement {
  date: string
  documentId: string
  type: 'CMO' | 'POSO'
  number: number | string
  thirdPartyName: string | null
  quantity: number
  runningBalance: number
}

export interface OfficialLedgerProductDetail {
  product: { id: string; code: string; name: string }
  openingBalance: number
  closingBalance: number
  movements: OfficialLedgerMovement[]
}
