export type {
  Bin,
  BinWithStock,
  WarehouseDetail,
  WarehouseListItem,
  WarehouseRecord,
  WarehouseType,
  Zone,
  ZoneWithBins,
} from '@contracts/warehouses'

import type { WarehouseType } from '@contracts/warehouses'

export interface CreateWarehousePayload {
  name: string
  type: WarehouseType
}

export interface UpdateWarehousePayload {
  name?: string
  type?: WarehouseType
  active?: boolean
}

export interface CreateZonePayload {
  name: string
}
export interface UpdateZonePayload {
  name?: string
  active?: boolean
}

export interface CreateBinPayload {
  code: number
}
export interface UpdateBinPayload {
  code?: number
  active?: boolean
}
