import { api } from "./api";
import type {
  ApiResponse,
  Warehouse,
  WarehouseDetail,
  Bin,
  ZoneSummary,
  CreateWarehousePayload,
  UpdateWarehousePayload,
  CreateZonePayload,
  UpdateZonePayload,
  CreateBinPayload,
  UpdateBinPayload,
} from "@/types";

export interface GetWarehousesParams {
  active?: boolean;
}

export async function getWarehouses(): Promise<Warehouse[]> {
  const res = await api.get<ApiResponse<Warehouse[]>>("/warehouses");
  return res.data.data;
}

export async function getWarehouse(id: string): Promise<WarehouseDetail> {
  const res = await api.get<ApiResponse<WarehouseDetail>>(`/warehouses/${id}`);
  return res.data.data;
}

export async function createWarehouse(
  payload: CreateWarehousePayload,
): Promise<Warehouse> {
  const res = await api.post<ApiResponse<Warehouse>>("/warehouses", payload);
  return res.data.data;
}

export async function updateWarehouse(
  id: string,
  payload: UpdateWarehousePayload,
): Promise<Warehouse> {
  const res = await api.patch<ApiResponse<Warehouse>>(
    `/warehouses/${id}`,
    payload,
  );
  return res.data.data;
}

export async function deleteWarehouse(id: string): Promise<void> {
  await api.delete(`/warehouses/${id}`);
}

export async function createZone(
  warehouseId: string,
  payload: CreateZonePayload,
): Promise<ZoneSummary> {
  const res = await api.post<ApiResponse<ZoneSummary>>(
    `/warehouses/${warehouseId}/zones`,
    payload,
  );
  return res.data.data;
}

export async function updateZone(
  warehouseId: string,
  zoneId: string,
  payload: UpdateZonePayload,
): Promise<ZoneSummary> {
  const res = await api.patch<ApiResponse<ZoneSummary>>(
    `/warehouses/${warehouseId}/zones/${zoneId}`,
    payload,
  );
  return res.data.data;
}

export async function createBin(
  warehouseId: string,
  zoneId: string,
  payload: CreateBinPayload,
): Promise<Bin> {
  const res = await api.post<ApiResponse<Bin>>(
    `/warehouses/${warehouseId}/zones/${zoneId}/bins`,
    payload,
  );
  return res.data.data;
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
  );
  return res.data.data;
}
