import { api } from "./api";
import type { ApiResponse, SystemStatus } from "@/types";

export async function getSystemStatus(): Promise<SystemStatus> {
  const res = await api.get<ApiResponse<SystemStatus>>("/system/status");
  return res.data.data;
}

export async function setReadOnlyMode(active: boolean): Promise<SystemStatus> {
  const res = await api.post<ApiResponse<SystemStatus>>(
    "/system/read-only/toggle",
    { active },
  );
  return res.data.data;
}
