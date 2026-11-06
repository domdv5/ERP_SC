// Contrato del sistema: GET /system/status y POST /system/read-only/toggle, tal como viajan en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

export interface SystemStatusActivatedBy {
  id: string;
  name: string;
}

export interface SystemStatus {
  readOnlyMode: boolean;
  activatedAt: string | null;
  activatedBy: SystemStatusActivatedBy | null;
}
