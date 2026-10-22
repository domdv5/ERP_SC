import { api } from './api'
import type { ApiResponse, City, Department } from '@/types'

export async function getDepartments(): Promise<Department[]> {
  const res = await api.get<ApiResponse<Department[]>>('/locations/departments')
  return res.data.data
}

export async function getCities(departmentCode: string): Promise<City[]> {
  const res = await api.get<ApiResponse<City[]>>(`/locations/departments/${departmentCode}/cities`)
  return res.data.data
}
