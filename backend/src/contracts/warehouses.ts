// Contrato de bodegas, zonas y bultos: lo que entregan los endpoints de /warehouses, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

export type WarehouseType = 'store' | 'warehouse';

// POST y PATCH /warehouses devuelven la fila sin relaciones
export interface WarehouseRecord {
  id: string;
  name: string;
  type: WarehouseType;
  active: boolean;
  createdAt: string;
}

// GET /warehouses
export interface WarehouseListItem extends WarehouseRecord {
  _count: { zones: number };
}

// GET/POST/PATCH de zonas devuelven la fila sin bultos
export interface Zone {
  id: string;
  warehouseId: string;
  name: string;
  active: boolean;
  createdAt: string;
}

// GET/POST/PATCH de bultos
export interface Bin {
  id: string;
  zoneId: string;
  code: number;
  active: boolean;
  createdAt: string;
}

export interface BinWithStock extends Bin {
  occupied: boolean;
  binStocks: { productId: string; quantity: number }[];
}

export interface ZoneWithBins extends Zone {
  bins: BinWithStock[];
}

// GET /warehouses/:id (null si no existe)
export interface WarehouseDetail extends WarehouseRecord {
  zones: ZoneWithBins[];
}
