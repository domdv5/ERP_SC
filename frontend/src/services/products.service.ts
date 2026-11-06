import { api } from './api'
import type { ApiResponse } from '@/types'
import type {
  BrandOption,
  Gender,
  ProductCategory,
  ProductByCode,
  ProductListResponse,
  ProductLocationsResult,
  ProductRecord,
} from '@/types/product.types'

export interface GetProductsParams {
  page?: number
  limit?: number
  search?: string
  active?: boolean
  categoryId?: string
  brandId?: string
  genderId?: string
  // Filtra por proveedor (a través de sus marcas activas). Se usa en compras y devoluciones
  // para limitar el buscador de producto a las marcas del proveedor elegido en el documento.
  supplierId?: string
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

export async function getProducts(params?: GetProductsParams): Promise<ProductListResponse> {
  const res = await api.get<ApiResponse<ProductListResponse>>('/products', {
    params,
  })
  return res.data.data
}

export async function getProductByCode(code: string): Promise<ProductByCode> {
  const res = await api.get<ApiResponse<ProductByCode>>(
    `/products/by-code/${encodeURIComponent(code)}`,
  )
  return res.data.data
}

export async function getProductLocationsByCode(code: string): Promise<ProductLocationsResult> {
  const res = await api.get<ApiResponse<ProductLocationsResult>>(
    `/products/by-code/${encodeURIComponent(code)}/locations`,
  )
  return res.data.data
}

export async function getBrands(): Promise<BrandOption[]> {
  const res = await api.get<ApiResponse<BrandOption[]>>('/products/brands')
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

export async function createProduct(payload: CreateProductPayload): Promise<ProductRecord> {
  const res = await api.post<ApiResponse<ProductRecord>>('/products', payload)
  return res.data.data
}

export async function updateProduct(
  id: string,
  payload: Partial<CreateProductPayload>,
): Promise<ProductRecord> {
  const res = await api.patch<ApiResponse<ProductRecord>>(`/products/${id}`, payload)
  return res.data.data
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`)
}

export async function reactivateProduct(id: string): Promise<void> {
  await api.post(`/products/${id}/reactivate`)
}
