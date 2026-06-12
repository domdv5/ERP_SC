export type WarehouseType = 'store' | 'warehouse'

export interface Warehouse {
  id: string
  name: string
  type: WarehouseType
  active: boolean
  createdAt: string
  _count: { zones: number }
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
