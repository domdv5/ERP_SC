export type SelectionKind = 'warehouse' | 'zone' | 'bin'

export interface Selection {
  kind: SelectionKind
  warehouseId: string
  zoneId?: string
  binId?: string
}
