export type WarehouseType = 'store' | 'warehouse'

export interface Warehouse {
  id: string
  name: string
  type: WarehouseType
  active: boolean
  createdAt: string
  _count: { zones: number }
}

export interface Bin {
  id: string
  zoneId: string
  code: number
  active: boolean
  createdAt: string
}

export interface Zone {
  id: string
  warehouseId: string
  name: string
  active: boolean
  createdAt: string
  bins: Bin[]
}

export interface WarehouseDetail extends Omit<Warehouse, '_count'> {
  zones: Zone[]
}

export interface CreateWarehousePayload {
  name: string
  type: WarehouseType
}

export interface UpdateWarehousePayload {
  name?: string
  type?: WarehouseType
  active?: boolean
}

export interface CreateZonePayload { name: string }
export interface UpdateZonePayload { name?: string; active?: boolean }

export interface CreateBinPayload { code: number }
export interface UpdateBinPayload { code?: number; active?: boolean }

// Zone/Bin creation & update endpoints return the plain Prisma row —
// zones without their nested `bins` relation.
export type ZoneSummary = Omit<Zone, 'bins'>
