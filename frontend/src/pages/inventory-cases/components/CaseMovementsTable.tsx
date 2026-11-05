import { formatBogotaDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { InventoryCaseMovement } from '@/types/inventory-case.types'
import { formatSignedQuantity, getMovementLabel } from '../inventory-cases.constants'
import { DocumentLink } from './DocumentLink'

interface CaseMovementsTableProps {
  movements: InventoryCaseMovement[]
  adjustmentDocumentId: string
  suggestedOriginDocumentId: string | null
  // Documento elegido como origen; null = sin documento.
  selectedOriginId: string | null
  // Sin onSelectOrigin la tabla es de solo lectura (caso cerrado o sin permiso de cierre).
  onSelectOrigin?: (documentId: string) => void
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  })

export function CaseMovementsTable({
  movements,
  adjustmentDocumentId,
  suggestedOriginDocumentId,
  selectedOriginId,
  onSelectOrigin,
}: CaseMovementsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b border-ui-border">
            {['Fecha', 'Documento', 'Tipo', 'Cant.', 'Stock', 'Usuario'].map((h) => (
              <th
                key={h}
                className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3"
              >
                {h}
              </th>
            ))}
            {onSelectOrigin && (
              <th className="text-center text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3">
                Origen
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-ui-divide">
          {movements.map((movement) => {
            const document = movement.document
            const isAdjustment = document?.id === adjustmentDocumentId
            const isSuggested = Boolean(document) && document?.id === suggestedOriginDocumentId
            const isSelected = Boolean(document) && document?.id === selectedOriginId
            const canChoose = Boolean(onSelectOrigin && document && !isAdjustment)

            return (
              <tr
                key={movement.id}
                className={cn(
                  isAdjustment && 'bg-brand-secondary/10 font-medium',
                  !isAdjustment && isSelected && 'bg-amber-500/10',
                )}
              >
                <td className="px-4 py-3 text-content-secondary">
                  {formatBogotaDate(movement.createdAt)}{' '}
                  <span className="text-xs text-content-muted">
                    {formatTime(movement.createdAt)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {document ? (
                    <DocumentLink document={document} />
                  ) : (
                    <span className="text-content-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-content-secondary">
                  {getMovementLabel(movement)}
                  {isAdjustment && (
                    <span className="pill-stamp ml-2 text-content">Este ajuste</span>
                  )}
                  {isSuggested && (
                    <>
                      <span className="pill-stamp ml-2 text-amber-700 dark:text-amber-400">
                        Posible origen
                      </span>
                      <span className="block text-xs text-content-muted">
                        Sacó {Math.abs(movement.quantity)}, igual al ajuste
                      </span>
                    </>
                  )}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 font-medium',
                    movement.quantity < 0 ? 'text-red-600 dark:text-red-400' : 'text-content',
                  )}
                >
                  {formatSignedQuantity(movement.quantity)}
                </td>
                <td className="px-4 py-3 text-content-secondary">
                  {movement.previousStock ?? '—'} →{' '}
                  <span className="font-semibold text-content">{movement.newStock ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-content-secondary">{movement.user?.name ?? '—'}</td>
                {onSelectOrigin && (
                  <td className="px-4 py-3 text-center">
                    {canChoose && document && (
                      <input
                        type="radio"
                        name="origin-document"
                        checked={isSelected}
                        onChange={() => onSelectOrigin(document.id)}
                        aria-label={`Marcar ${document.type} ${document.number} como origen`}
                        className="accent-brand-secondary"
                      />
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
