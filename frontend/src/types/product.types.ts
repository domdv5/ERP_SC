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
}
