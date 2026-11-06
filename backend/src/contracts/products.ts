// Contrato de productos: lo que entregan los endpoints de /products, tal como viaja en JSON.
// Solo tipos planos (el frontend lo importa con `import type`). Decimal y Date viajan como string.

export type UnitOfMeasure = 'unidad' | 'docena';

export interface ProductBrand {
  id: string;
  name: string;
  active: boolean;
}

// GET /products/brands
export interface BrandOption extends ProductBrand {
  supplier: { internalNumber: number };
}

export interface Gender {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

// POST, PATCH, DELETE y POST :id/reactivate devuelven la fila sin relaciones
export interface ProductRecord {
  id: string;
  code: string;
  legacyCode: string | null;
  description: string;
  brandId: string;
  genderId: string;
  categoryId: string;
  salePrice: number;
  minSalePrice: number;
  active: boolean;
  avgCost: string;
  lastCost: string;
  unitOfMeasure: UnitOfMeasure;
  createdAt: string;
  updatedAt: string;
}

// GET /products/:id (null si no existe) y GET /products/by-code/:code
export interface ProductDetail extends ProductRecord {
  brand: ProductBrand;
  gender: Gender;
  category: ProductCategory;
}

export interface StockByWarehouse {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
}

export interface ProductListItem extends ProductDetail {
  stockByWarehouse: StockByWarehouse[];
  totalStock: number;
  reservedQuantity: number;
  remisionQuantity: number;
  // Puede ser negativo (ajuste de salida sobre stock reservado)
  availableStock: number;
}

export interface ProductListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  activeCount: number;
  inStockCount: number;
}

export interface ProductListResponse {
  items: ProductListItem[];
  meta: ProductListMeta;
}

export interface ProductLocation {
  warehouseId: string;
  warehouseName: string;
  zoneName: string;
  binCode: number;
  quantity: number;
}

export interface ProductLocationsResult {
  product: {
    id: string;
    code: string;
    description: string;
    brand: { id: string; name: string };
    active: boolean;
    unitOfMeasure: UnitOfMeasure;
  };
  locations: ProductLocation[];
  warehouseTotals: StockByWarehouse[];
  totalBinQuantity: number;
  hasUnassignedStock: boolean;
}
