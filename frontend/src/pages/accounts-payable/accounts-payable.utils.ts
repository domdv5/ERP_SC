import type { AccountsPayableHistoryEntry, AccountsPayableStatus, DocumentType } from '@/types'
import { formatDateOnly, formatBogotaDate } from '@/lib/format'

export const formatDate = formatDateOnly

// appliedAt (aplicación de saldo a favor) es @db.Timestamptz, un evento real — a diferencia de
// formatDate, este sí se lee en horario Bogotá para mostrar el día en que ocurrió localmente.
export const formatEventDate = formatBogotaDate

// El historial de una CxP mezcla fechas @db.Date (egreso/pago_historico) con un timestamptz real
// (nota_credito_historica → appliedAt) en un mismo campo `date` — el source decide el formateador.
export const formatHistoryDate = (entry: Pick<AccountsPayableHistoryEntry, 'source' | 'date'>) =>
  entry.source === 'nota_credito_historica' ? formatEventDate(entry.date) : formatDate(entry.date)

export const STATUS_LABELS: Record<AccountsPayableStatus, { label: string; className: string }> = {
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

/** Mapa local de etiquetas: los tipos de documento que pueden originar una cuenta por pagar. */
export const DOCUMENT_TYPE_LABELS: Partial<Record<DocumentType, string>> = {
  CM: 'Compra',
  DVC: 'Dev. Compra',
  EAI: 'Entrada Ajuste',
  SAJ: 'Salida Ajuste',
  T: 'Traslado',
}
