export interface Brand {
  id: string
  name: string
  active: boolean
  supplier: { internalNumber: number } | null
}

export interface Gender {
  id: string
  code: string
  name: string
  active: boolean
}

export interface ProductCategory {
  id: string
  code: string
  name: string
  active: boolean
}

export interface StockByWarehouse {
  warehouseId: string
  warehouseName: string
  quantity: number
}

export interface Product {
  id: string
  code: string
  legacyCode?: string | null
  description: string
  brandId: string
  genderId: string
  categoryId: string
  salePrice: number
  minSalePrice: number
  active: boolean
  avgCost: string
  lastCost: string
  unitOfMeasure: 'unidad' | 'docena'
  createdAt: string
  updatedAt: string
  brand: Brand
  gender: Gender
  category: ProductCategory
  stockByWarehouse: StockByWarehouse[]
  totalStock: number
  // Cantidad reservada por preventas confirmadas que aún no se han liberado del todo.
  reservedQuantity: number
  // Cantidad reservada por remisiones confirmadas, ya restadas las liberaciones y conversiones.
  remisionQuantity: number
  // Stock ya neteado de reservas; negativo es válido (ajuste de salida sobre stock reservado) y se pinta en rojo.
  availableStock: number
}

export interface ProductLocation {
  warehouseId: string
  warehouseName: string
  zoneName: string
  binCode: number
  quantity: number
}

export interface ProductLocationsResult {
  product: {
    id: string
    code: string
    description: string
    brand: { id: string; name: string }
    active: boolean
    unitOfMeasure: 'unidad' | 'docena'
  }
  locations: ProductLocation[]
  warehouseTotals: { warehouseId: string; warehouseName: string; quantity: number }[]
  totalBinQuantity: number
  hasUnassignedStock: boolean
}
