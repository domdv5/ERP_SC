import { api } from './api'
import type {
  ApiResponse,
  Bin,
  WarehouseDetail,
  WarehouseListItem,
  WarehouseRecord,
  Zone,
  CreateWarehousePayload,
  UpdateWarehousePayload,
  CreateZonePayload,
  UpdateZonePayload,
  CreateBinPayload,
  UpdateBinPayload,
} from '@/types'

export interface GetWarehousesParams {
  active?: boolean
}

export async function getWarehouses(): Promise<WarehouseListItem[]> {
  const res = await api.get<ApiResponse<WarehouseListItem[]>>('/warehouses')
  return res.data.data
}

export async function getWarehouse(id: string): Promise<WarehouseDetail | null> {
  const res = await api.get<ApiResponse<WarehouseDetail | null>>(`/warehouses/${id}`)
  return res.data.data
}

export async function createWarehouse(payload: CreateWarehousePayload): Promise<WarehouseRecord> {
  const res = await api.post<ApiResponse<WarehouseRecord>>('/warehouses', payload)
  return res.data.data
}

export async function updateWarehouse(
  id: string,
  payload: UpdateWarehousePayload,
): Promise<WarehouseRecord> {
  const res = await api.patch<ApiResponse<WarehouseRecord>>(`/warehouses/${id}`, payload)
  return res.data.data
}

export async function createZone(warehouseId: string, payload: CreateZonePayload): Promise<Zone> {
  const res = await api.post<ApiResponse<Zone>>(`/warehouses/${warehouseId}/zones`, payload)
  return res.data.data
}

export async function updateZone(
  warehouseId: string,
  zoneId: string,
  payload: UpdateZonePayload,
): Promise<Zone> {
  const res = await api.patch<ApiResponse<Zone>>(
    `/warehouses/${warehouseId}/zones/${zoneId}`,
    payload,
  )
  return res.data.data
}

export async function createBin(
  warehouseId: string,
  zoneId: string,
  payload: CreateBinPayload,
): Promise<Bin> {
  const res = await api.post<ApiResponse<Bin>>(
    `/warehouses/${warehouseId}/zones/${zoneId}/bins`,
    payload,
  )
  return res.data.data
}

export async function updateBin(
  warehouseId: string,
  zoneId: string,
  binId: string,
  payload: UpdateBinPayload,
): Promise<Bin> {
  const res = await api.patch<ApiResponse<Bin>>(
    `/warehouses/${warehouseId}/zones/${zoneId}/bins/${binId}`,
    payload,
  )
  return res.data.data
}
