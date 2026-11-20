import { Wallet } from 'lucide-react'

import { formatCOP } from '@/lib/format'

export interface CreditsPanelCredit {
  id: string
  balance: number
  // Texto de referencia de la fila (número del documento de origen del saldo).
  label: string
}

interface CreditsPanelProps {
  title: string
  credits: CreditsPanelCredit[]
  // Monto aplicado por cada saldo (id del saldo → su saldo completo, ausente si no se usa).
  creditAmounts: Record<string, number>
  setCreditUsed: (creditId: string, used: boolean) => void
  canUseCredit: (creditId: string) => boolean
  creditsApplied: number
  totalAvailable: number
  error?: string
}

// Casilla "Usar saldo": un saldo se aplica completo o no; sin marcar y sin caber queda deshabilitada, marcada siempre se puede soltar.
export function UseCreditCheckbox({
  checked,
  canUse,
  onChange,
}: {
  checked: boolean
  canUse: boolean
  onChange: (used: boolean) => void
}) {
  const blocked = !checked && !canUse
  return (
    <label className="flex items-center gap-2 text-xs text-content-secondary">
      <input
        type="checkbox"
        checked={checked}
        disabled={blocked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand-secondary disabled:opacity-50"
      />
      <span>Usar saldo</span>
      {blocked && (
        <span className="text-content-faint font-accent">Saldo mayor que lo pendiente</span>
      )}
    </label>
  )
}

// Panel de saldo a favor del checkout de ventas; propone los saldos completos que caben (más antiguos primero).
export function CreditsPanel({
  title,
  credits,
  creditAmounts,
  setCreditUsed,
  canUseCredit,
  creditsApplied,
  totalAvailable,
  error,
}: CreditsPanelProps) {
  if (credits.length === 0) return null

  return (
    <div className="rounded-md border-2 border-emerald-700 dark:border-emerald-500/60 bg-emerald-50 dark:bg-emerald-500/10 p-4">
      <p className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
        <Wallet className="w-3.5 h-3.5" />
        {title}
      </p>
      <p className="text-xs text-content-muted mt-1 font-accent">
        Disponible en total: {formatCOP(totalAvailable)}. Se descuenta del total.
      </p>

      <div className="mt-3 space-y-2">
        {credits.map((credit) => (
          <div key={credit.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-content truncate">{credit.label}</p>
              <p className="text-[11px] text-content-faint font-accent">
                Saldo {formatCOP(credit.balance)}
              </p>
            </div>
            <UseCreditCheckbox
              checked={(creditAmounts[credit.id] ?? 0) > 0}
              canUse={canUseCredit(credit.id)}
              onChange={(used) => setCreditUsed(credit.id, used)}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t-2 border-emerald-700/40 dark:border-emerald-500/30 mt-3 pt-2 text-sm">
        <span className="text-content-secondary">Saldo aplicado</span>
        <span className="text-content font-mono font-semibold">{formatCOP(creditsApplied)}</span>
      </div>
      {error && <p className="mt-2 text-xs text-red-500 font-accent">{error}</p>}
    </div>
  )
}
