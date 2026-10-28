import { Loader2 } from 'lucide-react'
import { formatCOP } from '@/lib/format'

interface SaleSummaryProps {
  official: boolean
  isCredit: boolean
  total: number
  creditsApplied: number
  totalToPay: number
  officialTotals: { subtotal: number; taxTotal: number }
  itemCount: number
  totalUnits: number
  missingItems: string[]
  canConfirm: boolean
  isSubmitting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function SaleSummary({
  official,
  isCredit,
  total,
  creditsApplied,
  totalToPay,
  officialTotals,
  itemCount,
  totalUnits,
  missingItems,
  canConfirm,
  isSubmitting,
  onConfirm,
  onCancel,
}: SaleSummaryProps) {
  return (
    <div className="lg:sticky lg:top-6 space-y-4">
      <div className="card-hard p-6 space-y-4">
        <div>
          <p className="text-xs text-content-faint font-accent uppercase tracking-wider">
            {official
              ? 'Total a pagar (con IVA)'
              : creditsApplied > 0
                ? isCredit
                  ? 'Total a crédito (neto)'
                  : 'Total a pagar en efectivo'
                : 'Total a pagar'}
          </p>
          <p className="text-4xl text-content mt-1 font-display tabular-nums">
            {formatCOP(totalToPay)}
          </p>
          {official && (
            <div className="mt-2 space-y-0.5 text-xs font-accent">
              <div className="flex items-center justify-between text-content-muted">
                <span>Subtotal (sin IVA)</span>
                <span className="font-mono">{formatCOP(officialTotals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-content-muted">
                <span>IVA (19%)</span>
                <span className="font-mono">{formatCOP(officialTotals.taxTotal)}</span>
              </div>
            </div>
          )}
          {creditsApplied > 0 && (
            <div className="mt-2 space-y-0.5 text-xs font-accent">
              <div className="flex items-center justify-between text-content-muted">
                <span>Total</span>
                <span className="font-mono">{formatCOP(total)}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span>Saldo a favor</span>
                <span className="font-mono">− {formatCOP(creditsApplied)}</span>
              </div>
            </div>
          )}
          <p className="text-xs text-content-muted mt-2 font-accent">
            {itemCount} producto{itemCount === 1 ? '' : 's'} · {totalUnits} unidad
            {totalUnits === 1 ? '' : 'es'}
          </p>
        </div>

        {missingItems.length > 0 && (
          <ul className="space-y-1.5 text-xs text-amber-600 dark:text-amber-400 border-t border-ui-divide pt-4">
            {missingItems.map((m) => (
              <li key={m} className="flex items-start gap-1.5">
                <span className="mt-0.5">•</span>
                {m}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm || isSubmitting}
          className="btn-primary w-full flex items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Confirmar venta
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary w-full px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  )
}
