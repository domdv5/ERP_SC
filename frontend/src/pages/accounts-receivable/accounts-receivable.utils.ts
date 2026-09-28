import type { AccountsReceivableStatus, DocumentType } from '@/types'

export const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  const date = new Date(iso)
  const day = date.toLocaleDateString('es-CO', { day: 'numeric', timeZone: 'America/Bogota' })
  // toLocaleDateString con month:'short' agrega un punto ("ago."); se saca para que quede "17 ago 2026".
  const month = date
    .toLocaleDateString('es-CO', { month: 'short', timeZone: 'America/Bogota' })
    .replace('.', '')
  const year = date.toLocaleDateString('es-CO', { year: 'numeric', timeZone: 'America/Bogota' })
  return `${day} ${month} ${year}`
}

export const STATUS_LABELS: Record<AccountsReceivableStatus, { label: string; className: string }> =
  {
    pending: {
      label: 'Pendiente',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    },
    partial: {
      label: 'Parcial',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
    },
    paid: {
      label: 'Pagado',
      className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
    },
  }

/** Mapa local de etiquetas: hoy solo COT (venta a crédito) origina una cuenta por cobrar. */
export const DOCUMENT_TYPE_LABELS: Partial<Record<DocumentType, string>> = {
  COT: 'Venta a crédito',
}
