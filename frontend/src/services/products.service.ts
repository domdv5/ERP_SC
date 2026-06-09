import { api } from './api'
import type { ApiResponse, Product } from '@/types'

export interface ProductMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface GetProductsParams {
  page?: number
  limit?: number
  search?: string
  active?: boolean
  categoryId?: string
  brandId?: string
  genderId?: string
}

export async function getProducts(params?: GetProductsParams): Promise<{ items: Product[]; meta: ProductMeta }> {
  const res = await api.get<ApiResponse<{ items: Product[]; meta: ProductMeta }>>('/products', { params })
  return res.data.data
}
