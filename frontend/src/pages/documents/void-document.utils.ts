import type { DocumentType, DocumentVoidReason } from '@/types'
import { DOCUMENT_VOID_REASONS_BY_TYPE } from '@/types'
import type { VoidDocumentPayload } from '@/services/documents.service'

export const MAX_VOID_REASON_LENGTH = 500

export function getVoidReasonsForType(type: DocumentType): readonly DocumentVoidReason[] | null {
  return DOCUMENT_VOID_REASONS_BY_TYPE[type] ?? null
}

// Devuelve el cuerpo a enviar, o null si falta el motivo o "Otro" no trae texto.
export function buildVoidPayload(
  reason: DocumentVoidReason | '',
  reasonOther: string,
): VoidDocumentPayload | null {
  if (reason === '') return null
  if (reason !== 'otro') return { reason }
  const trimmedOther = reasonOther.trim()
  return trimmedOther ? { reason, reasonOther: trimmedOther } : null
}
