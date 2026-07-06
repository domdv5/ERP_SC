import { useEffect, useMemo, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCOP } from '@/pages/accounts-payable/accounts-payable.utils'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const baseSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  paymentDate: z.string().min(1, 'La fecha es requerida'),
  paymentMethod: z.string().min(1, 'Selecciona un método de pago'),
  bankDestination: z.string().optional(),
  reference: z.string().optional(),
})

export type RegisterPaymentFormValues = z.infer<typeof baseSchema>

const PAYMENT_METHODS = [
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Transferencia', label: 'Transferencia' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'Tarjeta', label: 'Tarjeta' },
  { value: 'Otro', label: 'Otro' },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RegisterPaymentFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: RegisterPaymentFormValues) => void
  isPending: boolean
  /** Saldo pendiente actual de la cuenta — usado para validar que el pago no lo exceda. */
  pendingBalance: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full px-3 py-2 text-sm border border-ui-border-medium rounded-lg bg-surface text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all',
        className,
      )}
      {...props}
    />
  )
}

function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full px-3 py-2 text-sm border border-ui-border-medium rounded-lg bg-surface text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

const today = () => new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RegisterPaymentForm({ open, onClose, onSubmit, isPending, pendingBalance }: RegisterPaymentFormProps) {
  const schema = useMemo(
    () =>
      baseSchema.refine((data) => data.amount <= pendingBalance, {
        message: `El monto no puede superar el saldo pendiente (${formatCOP(pendingBalance)})`,
        path: ['amount'],
      }),
    [pendingBalance],
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterPaymentFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      amount: 0,
      paymentDate: today(),
      paymentMethod: '',
      bankDestination: '',
      reference: '',
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        amount: 0,
        paymentDate: today(),
        paymentMethod: '',
        bankDestination: '',
        reference: '',
      })
    }
  }, [open, reset])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border gradient-dark">
          <div>
            <h2 className="text-white font-semibold">Registrar pago</h2>
            <p className="text-white/50 text-xs mt-0.5 font-accent">
              Saldo pendiente: {formatCOP(pendingBalance)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body + Footer */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="px-6 py-5 space-y-4">
            <Field label="Monto" error={errors.amount?.message}>
              <Input
                {...register('amount')}
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                autoFocus
              />
            </Field>

            <Field label="Fecha de pago" error={errors.paymentDate?.message}>
              <Input {...register('paymentDate')} type="date" />
            </Field>

            <Field label="Método de pago" error={errors.paymentMethod?.message}>
              <Select {...register('paymentMethod')} defaultValue="">
                <option value="" disabled>
                  Selecciona un método
                </option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Banco destino (opcional)" error={errors.bankDestination?.message}>
              <Input {...register('bankDestination')} placeholder="Ej: Bancolombia" autoComplete="off" />
            </Field>

            <Field label="Referencia (opcional)" error={errors.reference?.message}>
              <Input {...register('reference')} placeholder="Ej: N° de comprobante" autoComplete="off" />
            </Field>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-ui-border flex justify-end gap-3 bg-surface-raised">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-content-secondary bg-surface border border-ui-border-medium rounded-lg hover:bg-surface-raised transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-all hover:opacity-90 disabled:opacity-50 gradient-action"
            >
              {isPending ? 'Guardando...' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
