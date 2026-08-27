import { api } from './api'
import type { ApiResponse } from '@/types'
import type {
  Document,
  DocumentListItem,
  DocumentMeta,
  GetDocumentsParams,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  ReleaseItemsPayload,
  ConvertDocumentPayload,
  CustomerCreditSummary,
} from '@/types/document.types'

export async function getDocuments(
  params?: GetDocumentsParams,
): Promise<{ items: DocumentListItem[]; meta: DocumentMeta }> {
  const res = await api.get<ApiResponse<{ items: DocumentListItem[]; meta: DocumentMeta }>>(
    '/documents',
    { params },
  )
  return res.data.data
}

export async function getDocument(id: string): Promise<Document> {
  const res = await api.get<ApiResponse<Document>>(`/documents/${id}`)
  return res.data.data
}

export async function createDocument(payload: CreateDocumentPayload): Promise<Document> {
  const res = await api.post<ApiResponse<Document>>('/documents', payload)
  return res.data.data
}

export async function updateDocument(
  id: string,
  payload: UpdateDocumentPayload,
): Promise<Document> {
  const res = await api.patch<ApiResponse<Document>>(`/documents/${id}`, payload)
  return res.data.data
}

export async function confirmDocument(id: string): Promise<Document> {
  const res = await api.post<ApiResponse<Document>>(`/documents/${id}/confirm`)
  return res.data.data
}

export async function voidDocument(id: string): Promise<Document> {
  const res = await api.post<ApiResponse<Document>>(`/documents/${id}/void`)
  return res.data.data
}

export async function duplicateDocument(id: string): Promise<Document> {
  const res = await api.post<ApiResponse<Document>>(`/documents/${id}/duplicate`)
  return res.data.data
}

// Convierte una PV confirmada (con pendiente > 0) en un borrador POS — la reserva de origen
// solo se consume cuando ese borrador POS se confirma (ver PosEffectStrategy.confirm).
export async function convertDocument(
  id: string,
  payload: ConvertDocumentPayload,
): Promise<Document> {
  const res = await api.post<ApiResponse<Document>>(`/documents/${id}/convert`, payload)
  return res.data.data
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}`)
}

// Cupo de crédito del cliente (para el modo Crédito del checkout). El backend devuelve
// {0,0,0} para un customerId inexistente — llamar solo con un cliente ya seleccionado.
export async function getCustomerCredit(customerId: string): Promise<CustomerCreditSummary> {
  const res = await api.get<ApiResponse<CustomerCreditSummary>>(
    `/documents/customers/${customerId}/credit`,
  )
  return res.data.data
}

export async function releaseItems(id: string, payload: ReleaseItemsPayload): Promise<Document> {
  const res = await api.post<ApiResponse<Document>>(`/documents/${id}/release-items`, payload)
  return res.data.data
}

// Esta ruta bypasea el interceptor global {success,data} — responde el binario del PDF
// directamente, por eso es la única función del servicio que no desenvuelve res.data.data.
export async function printDocument(id: string): Promise<Blob> {
  const res = await api.get(`/documents/${id}/print`, { responseType: 'blob' })
  return res.data
}
