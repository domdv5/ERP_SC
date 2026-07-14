import { api } from './api'
import type { ApiResponse, Product } from '@/types'
import type { Brand, Gender, ProductCategory } from '@/types/product.types'

export interface ProductMeta {
  total: number
  page: number
  limit: number
  totalPages: number
  activeCount: number
  inStockCount: number
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

export interface CreateProductPayload {
  code: string
  description: string
  brandId: string
  genderId: string
  categoryId: string
  salePrice: number
  minSalePrice: number
  legacyCode?: string
  unitOfMeasure?: 'unidad' | 'docena'
}

export async function getProducts(params?: GetProductsParams): Promise<{ items: Product[]; meta: ProductMeta }> {
  const res = await api.get<ApiResponse<{ items: Product[]; meta: ProductMeta }>>('/products', { params })
  return res.data.data
}

export async function getBrands(): Promise<Brand[]> {
  const res = await api.get<ApiResponse<Brand[]>>('/products/brands')
  return res.data.data
}

export async function getGenders(): Promise<Gender[]> {
  const res = await api.get<ApiResponse<Gender[]>>('/products/genders')
  return res.data.data
}

export async function getCategories(): Promise<ProductCategory[]> {
  const res = await api.get<ApiResponse<ProductCategory[]>>('/products/categories')
  return res.data.data
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const res = await api.post<ApiResponse<Product>>('/products', payload)
  return res.data.data
}

export async function updateProduct(id: string, payload: Partial<CreateProductPayload>): Promise<Product> {
  const res = await api.patch<ApiResponse<Product>>(`/products/${id}`, payload)
  return res.data.data
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`)
}
