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

// Convierte una preventa confirmada (con cantidad pendiente) en un borrador de venta. La
// reserva de origen recién se descuenta cuando esa venta se confirma.
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

// Cupo de crédito del cliente (para el modo Crédito del checkout). El backend devuelve todo
// en cero si el cliente no existe, así que llamar solo con un cliente ya elegido.
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

// Esta ruta no pasa por el envoltorio estándar de la API: responde el PDF directo, por eso es
// la única función del servicio que no desenvuelve la respuesta.
export async function printDocument(id: string): Promise<Blob> {
  const res = await api.get(`/documents/${id}/print`, { responseType: 'blob' })
  return res.data
}
