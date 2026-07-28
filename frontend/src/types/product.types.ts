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
  // Cantidad reservada lógicamente por preventas (PV) confirmadas y aún no liberadas del todo.
  reservedQuantity: number
  // totalStock - reservedQuantity. Puede ser negativo si un ajuste de stock (SAJ) saca mercancía
  // ya reservada — comportamiento esperado, no un bug; se muestra en rojo en la UI.
  availableStock: number
}
