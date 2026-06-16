import { api } from './api'
import type { ApiResponse } from '@/types'
import type {
  Document,
  DocumentListItem,
  DocumentMeta,
  GetDocumentsParams,
  CreateDocumentPayload,
  UpdateDocumentPayload,
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

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}`)
}
