import { api } from "./api";
import type {
  ApiResponse,
  Warehouse,
  CreateWarehousePayload,
  UpdateWarehousePayload,
} from "@/types";

export interface GetWarehousesParams {
  active?: boolean;
}

export async function getWarehouses(): Promise<Warehouse[]> {
  const res = await api.get<ApiResponse<Warehouse[]>>("/warehouses");
  return res.data.data;
}

export async function getWarehouse(id: string): Promise<Warehouse> {
  const res = await api.get<ApiResponse<Warehouse>>(`/warehouses/${id}`);
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
