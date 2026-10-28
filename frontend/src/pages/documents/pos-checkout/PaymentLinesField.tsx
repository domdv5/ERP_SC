import { Plus, Trash2, Wallet } from 'lucide-react'
import { ThousandsInput } from '@/components/shared'
import { cn } from '@/lib/utils'
import { formatCOP } from '@/lib/format'
import { PAYMENT_METHOD_OPTIONS } from '@/pages/documents/document.constants'
import type { PaymentLine } from '@/pages/documents/pos-checkout.utils'
import type { PaymentMethod } from '@/types/document.types'

interface PaymentLinesFieldProps {
  paymentLines: PaymentLine[]
  paymentDifference: number
  onMethodChange: (index: number, method: PaymentMethod | '') => void
  onAmountChange: (index: number, amount: number | undefined) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

export function PaymentLinesField({
  paymentLines,
  paymentDifference,
  onMethodChange,
  onAmountChange,
  onAdd,
  onRemove,
}: PaymentLinesFieldProps) {
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
        <Wallet className="w-3.5 h-3.5" />
        Formas de pago <span className="text-red-500">*</span>
      </label>
      {paymentLines.map((line, index) => (
        <div key={index} className="flex items-center gap-2">
          <select
            value={line.method}
            onChange={(e) => onMethodChange(index, e.target.value as PaymentMethod | '')}
            className="input-hard flex-1 min-w-0 px-3 py-2 text-sm text-content transition-all border-ui-border-medium"
          >
            <option value="">Selecciona una forma de pago</option>
            {PAYMENT_METHOD_OPTIONS.filter(
              (opt) =>
                opt.value === line.method ||
                !paymentLines.some((other) => other.method === opt.value),
            ).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ThousandsInput
            value={line.amount}
            onChange={(v) => onAmountChange(index, v)}
            className="w-36 py-2 text-right bg-surface-raised"
          />
          {paymentLines.length > 1 && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label="Quitar forma de pago"
              className="p-2 text-content-faint hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onAdd}
          disabled={paymentLines.length >= PAYMENT_METHOD_OPTIONS.length}
          className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar forma de pago
        </button>
        {paymentDifference !== 0 && (
          <span
            className={cn(
              'text-sm font-medium',
              paymentDifference > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500',
            )}
          >
            {paymentDifference > 0
              ? `Falta ${formatCOP(paymentDifference)}`
              : `Sobra ${formatCOP(-paymentDifference)}`}
          </span>
        )}
      </div>
    </div>
  )
}
