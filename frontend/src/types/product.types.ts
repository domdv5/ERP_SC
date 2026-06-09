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
  stockCache: number
  avgCost: string
  lastCost: string
  createdAt: string
  updatedAt: string
  brand: Brand
  gender: Gender
  category: ProductCategory
}
