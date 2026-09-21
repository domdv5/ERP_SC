import { api } from './api'
import type {
  ApiResponse,
  Egreso,
  EgresoListItem,
  EgresoMeta,
  GetEgresosParams,
  EgresoOpenItems,
  CreateEgresoPayload,
} from '@/types'

export async function getEgresos(
  params?: GetEgresosParams,
): Promise<{ items: EgresoListItem[]; meta: EgresoMeta }> {
  const res = await api.get<ApiResponse<{ items: EgresoListItem[]; meta: EgresoMeta }>>(
    '/egresos',
    { params },
  )
  return res.data.data
}

export async function getEgreso(id: string): Promise<Egreso> {
  const res = await api.get<ApiResponse<Egreso>>(`/egresos/${id}`)
  return res.data.data
}

/** CxP abiertas y saldos a favor disponibles de un proveedor, para armar un nuevo egreso. */
export async function getEgresoOpenItems(supplierId: string): Promise<EgresoOpenItems> {
  const res = await api.get<ApiResponse<EgresoOpenItems>>(
    `/egresos/suppliers/${supplierId}/open-items`,
  )
  return res.data.data
}

export async function createEgreso(payload: CreateEgresoPayload): Promise<Egreso> {
  const res = await api.post<ApiResponse<Egreso>>('/egresos', payload)
  return res.data.data
}
