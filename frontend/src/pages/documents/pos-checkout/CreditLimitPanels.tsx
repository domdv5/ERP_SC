import { CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCOP } from '@/lib/format'
import type { CreditLimitExceededDetail, CreditLimitSummary } from '@/types/document.types'

interface CreditLimitPanelProps {
  creditData: CreditLimitSummary | undefined
  isLoading: boolean
  creditExceeded: boolean
  netAmount: number
}

// Panel de cupo de crédito — informativo, solo lectura. La validación real la hace
// el backend; esto solo muestra el bloqueo antes de confirmar.
export function CreditLimitPanel({
  creditData,
  isLoading,
  creditExceeded,
  netAmount,
}: CreditLimitPanelProps) {
  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/60 dark:bg-indigo-500/10 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
        <CreditCard className="w-3.5 h-3.5" />
        Cupo de crédito del cliente
      </p>
      {isLoading ? (
        <p className="text-sm text-content-muted mt-2 font-accent">Consultando cupo...</p>
      ) : creditData ? (
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <p className="text-[11px] text-content-faint font-accent uppercase tracking-wide">
              Límite
            </p>
            <p className="text-sm text-content mt-0.5 font-mono">
              {formatCOP(creditData.creditLimit)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-content-faint font-accent uppercase tracking-wide">
              Usado
            </p>
            <p className="text-sm text-content mt-0.5 font-mono">
              {formatCOP(creditData.usedCredit)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-content-faint font-accent uppercase tracking-wide">
              Disponible
            </p>
            <p
              className={cn(
                'text-sm mt-0.5 font-mono',
                creditData.availableCredit <= 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {formatCOP(creditData.availableCredit)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-content-muted mt-2 font-accent">No se pudo consultar el cupo.</p>
      )}
      {creditExceeded && creditData && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-3">
          El neto a crédito ({formatCOP(netAmount)}) supera el cupo disponible (
          {formatCOP(creditData.availableCredit)}). Para realizarla, aumenta el cupo del cliente
          desde su ficha (requiere autorización).
        </p>
      )}
    </div>
  )
}

interface CreditLimitErrorPanelProps {
  message: string
  detail: CreditLimitExceededDetail
}

// Error de cupo devuelto por el backend (dos ventas compitiendo por el cupo, o al convertir).
export function CreditLimitErrorPanel({ message, detail }: CreditLimitErrorPanelProps) {
  return (
    <div className="rounded-xl border-2 border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-4">
      <p className="text-sm text-red-700 dark:text-red-400 font-medium">{message}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
        <div>
          <p className="text-red-600/70 dark:text-red-400/70 font-accent">Límite</p>
          <p className="text-red-700 dark:text-red-400 mt-0.5 font-mono">
            {formatCOP(detail.creditLimit)}
          </p>
        </div>
        <div>
          <p className="text-red-600/70 dark:text-red-400/70 font-accent">Usado</p>
          <p className="text-red-700 dark:text-red-400 mt-0.5 font-mono">
            {formatCOP(detail.usedCredit)}
          </p>
        </div>
        <div>
          <p className="text-red-600/70 dark:text-red-400/70 font-accent">Disponible</p>
          <p className="text-red-700 dark:text-red-400 mt-0.5 font-mono">
            {formatCOP(detail.availableCredit)}
          </p>
        </div>
        <div>
          <p className="text-red-600/70 dark:text-red-400/70 font-accent">Solicitado</p>
          <p className="text-red-700 dark:text-red-400 mt-0.5 font-mono">
            {formatCOP(detail.requested)}
          </p>
        </div>
      </div>
    </div>
  )
}
