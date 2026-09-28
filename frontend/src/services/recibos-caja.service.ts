import { api } from './api'
import type {
  ApiResponse,
  ReciboCaja,
  ReciboCajaListItem,
  ReciboCajaMeta,
  GetRecibosCajaParams,
  ReciboCajaOpenItems,
  CreateReciboCajaPayload,
} from '@/types'

export async function getRecibosCaja(
  params?: GetRecibosCajaParams,
): Promise<{ items: ReciboCajaListItem[]; meta: ReciboCajaMeta }> {
  const res = await api.get<ApiResponse<{ items: ReciboCajaListItem[]; meta: ReciboCajaMeta }>>(
    '/recibos-caja',
    { params },
  )
  return res.data.data
}

export async function getReciboCaja(id: string): Promise<ReciboCaja> {
  const res = await api.get<ApiResponse<ReciboCaja>>(`/recibos-caja/${id}`)
  return res.data.data
}

/** CxC abiertas de un cliente, para armar un nuevo recibo de caja. */
export async function getReciboCajaOpenItems(clientId: string): Promise<ReciboCajaOpenItems> {
  const res = await api.get<ApiResponse<ReciboCajaOpenItems>>(
    `/recibos-caja/clients/${clientId}/open-items`,
  )
  return res.data.data
}

export async function createReciboCaja(payload: CreateReciboCajaPayload): Promise<ReciboCaja> {
  const res = await api.post<ApiResponse<ReciboCaja>>('/recibos-caja', payload)
  return res.data.data
}
