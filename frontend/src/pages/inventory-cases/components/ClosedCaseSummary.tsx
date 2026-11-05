import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { reopenInventoryCase } from '@/services/inventory-cases.service'
import { invalidateInventoryCases } from '@/lib/invalidation'
import { formatBogotaDate } from '@/lib/format'
import { usePermission } from '@/hooks/usePermission'
import type { InventoryCaseDetail } from '@/types/inventory-case.types'
import { getCauseLabel } from '../inventory-cases.constants'
import { CaseStatusPill } from './CaseStatusPill'
import { DocumentLink } from './DocumentLink'

export function ClosedCaseSummary({ inventoryCase }: { inventoryCase: InventoryCaseDetail }) {
  const queryClient = useQueryClient()
  const canReopen = usePermission('inventory_case.reopen')

  const { mutate: reopenCase, isPending } = useMutation({
    mutationFn: () => reopenInventoryCase(inventoryCase.id),
    onSuccess: () => {
      invalidateInventoryCases(queryClient)
      toast.success('Caso reabierto')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Error al reabrir el caso')
    },
  })

  const { cause, justification, originDocument, closedBy, closedAt, reopenedBy, reopenedAt } =
    inventoryCase

  return (
    <section aria-labelledby="closed-case-title" className="card-hard p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="closed-case-title" className="text-lg text-content">
          Caso cerrado
        </h2>
        <CaseStatusPill status="closed" />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-content-muted">Causa</dt>
        <dd className="text-content font-medium">{cause ? getCauseLabel(cause) : '—'}</dd>
        <dt className="text-content-muted">Origen</dt>
        <dd className="text-content">
          {originDocument ? <DocumentLink document={originDocument} /> : 'Sin documento'}
        </dd>
        <dt className="text-content-muted">Cerró</dt>
        <dd className="text-content">
          {closedBy?.name ?? 'Sistema'}
          {closedAt && ` · ${formatBogotaDate(closedAt)}`}
        </dd>
        {reopenedBy && reopenedAt && (
          <>
            <dt className="text-content-muted">Reabierto antes</dt>
            <dd className="text-content">
              {reopenedBy.name} · {formatBogotaDate(reopenedAt)}
            </dd>
          </>
        )}
      </dl>

      {justification && (
        <blockquote className="border-l-4 border-ui-border-medium pl-3 text-sm text-content-secondary font-accent whitespace-pre-wrap">
          {justification}
        </blockquote>
      )}

      {canReopen && cause !== 'ajuste_anulado' && (
        <button
          type="button"
          onClick={() => reopenCase()}
          disabled={isPending}
          className="btn-secondary w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          {isPending ? 'Reabriendo...' : 'Reabrir caso'}
        </button>
      )}
    </section>
  )
}
