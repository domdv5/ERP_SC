import type { AccountsPayableStatus, DocumentType } from '@/types'

export const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)

export const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export const STATUS_LABELS: Record<AccountsPayableStatus, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
  partial: { label: 'Parcial', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  paid: { label: 'Pagado', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
}

/** Minimal local label map — the document types an AccountsPayable can originate from. */
export const DOCUMENT_TYPE_LABELS: Partial<Record<DocumentType, string>> = {
  CM: 'Compra',
  DVC: 'Dev. Compra',
  EAI: 'Entrada Ajuste',
  SAJ: 'Salida Ajuste',
  T: 'Traslado',
}

export const docNumber = (type: string, number: number) =>
  `${type}-${String(number).padStart(6, '0')}`
