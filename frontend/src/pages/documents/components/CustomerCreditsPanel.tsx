import { Wallet } from 'lucide-react'

import { ThousandsInput } from '@/components/shared'
import type { AvailableCustomerCredit } from '@/types/document.types'

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

const docNumber = (type: string, number: number) => `${type}-${String(number).padStart(6, '0')}`

interface CustomerCreditsPanelProps {
  availableCredits: AvailableCustomerCredit[]
  // Monto aplicado por cada saldo (id del saldo → monto). El usuario lo puede bajar.
  creditAmounts: Record<string, number>
  setCreditAmount: (creditId: string, next: number) => void
  creditsApplied: number
  totalAvailable: number
}

// Saldo a favor del cliente aplicable a esta venta. Propone aplicar el máximo posible (los
// saldos más antiguos primero) y deja bajar cada monto; la validación real la hace el backend.
export function CustomerCreditsPanel({
  availableCredits,
  creditAmounts,
  setCreditAmount,
  creditsApplied,
  totalAvailable,
}: CustomerCreditsPanelProps) {
  if (availableCredits.length === 0) return null

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-500/10 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        <Wallet className="w-3.5 h-3.5" />
        Saldo a favor del cliente
      </p>
      <p className="text-xs text-content-muted mt-1 font-accent">
        Disponible en total: {formatCOP(totalAvailable)}. Se descuenta del total de la venta.
      </p>

      <div className="mt-3 space-y-2">
        {availableCredits.map((credit) => (
          <div key={credit.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-content truncate">
                {docNumber(credit.sourceDocument.type, credit.sourceDocument.number)}
              </p>
              <p className="text-[11px] text-content-faint font-accent">
                Saldo {formatCOP(credit.balance)}
              </p>
            </div>
            <ThousandsInput
              value={creditAmounts[credit.id] ?? 0}
              onChange={(v) => setCreditAmount(credit.id, v ?? 0)}
              className="w-32 py-1.5 text-right bg-surface-raised"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-emerald-200/60 dark:border-emerald-500/20 mt-3 pt-2 text-sm">
        <span className="text-content-secondary">Saldo aplicado</span>
        <span className="text-content font-mono">{formatCOP(creditsApplied)}</span>
      </div>
    </div>
  )
}
