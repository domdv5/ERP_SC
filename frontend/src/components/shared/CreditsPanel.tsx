import { Check, Lock, Plus, Wallet } from 'lucide-react'

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

// Botón "Usar saldo": un saldo se aplica completo o no; sin aplicar y sin caber queda bloqueado, aplicado siempre se puede soltar.
export function UseCreditButton({
  checked,
  canUse,
  onChange,
}: {
  checked: boolean
  canUse: boolean
  onChange: (used: boolean) => void
}) {
  const blocked = !checked && !canUse
  const base =
    'inline-flex items-center justify-center gap-2 min-w-[11rem] px-4 py-2 text-sm font-semibold rounded-lg border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary'

  if (blocked) {
    return (
      <button
        type="button"
        disabled
        title="El saldo es mayor que lo pendiente: aumenta el abono para poder usarlo"
        className={`${base} border-dashed border-ui-border-medium text-content-faint cursor-not-allowed`}
      >
        <Lock className="h-4 w-4" aria-hidden />
        Mayor que lo pendiente
      </button>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={
        checked
          ? `${base} border-brand-secondary bg-brand-secondary text-brand-primary hover:bg-brand-secondary/90`
          : `${base} border-brand-secondary text-brand-secondary hover:bg-brand-secondary/10`
      }
    >
      {checked ? (
        <Check className="h-4 w-4" aria-hidden />
      ) : (
        <Plus className="h-4 w-4" aria-hidden />
      )}
      {checked ? 'Saldo aplicado' : 'Usar saldo'}
    </button>
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
            <UseCreditButton
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
