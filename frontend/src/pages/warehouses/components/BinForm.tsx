import { useEffect, type InputHTMLAttributes, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bin, Zone } from '@/types'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  code: z.coerce.number().int('Debe ser un número entero').positive('Debe ser un número positivo'),
  active: z.boolean().optional(),
})

export type BinFormValues = z.infer<typeof schema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BinFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: BinFormValues) => void
  isPending: boolean
  /** Zone the bin belongs to — used only to display context in the header. */
  zone?: Zone
  defaultValues?: Bin
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BinForm({ open, onClose, onSubmit, isPending, zone, defaultValues }: BinFormProps) {
  const isEdit = !!defaultValues

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BinFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      code: 1,
      active: true,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        code:   defaultValues?.code   ?? 1,
        active: defaultValues?.active ?? true,
      })
    }
  }, [open, defaultValues, reset])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border gradient-dark">
          <div>
            <h2 className="text-white font-semibold">
              {isEdit ? 'Editar bolsa' : 'Nueva bolsa'}
            </h2>
            <p className="text-white/50 text-xs mt-0.5 font-accent">
              {zone ? `Zona ${zone.name}` : isEdit ? 'Modifica la información de la bolsa' : 'Completa la información de la bolsa'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body + Footer */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="px-6 py-5 space-y-4">

            <Field label="Número de bolsa" error={errors.code?.message}>
              <Input
                {...register('code')}
                type="number"
                min={1}
                step={1}
                placeholder="Ej: 1"
                autoFocus
              />
            </Field>

            {isEdit && (
              <Field label="Estado" error={errors.active?.message}>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    {...register('active')}
                    className="w-4 h-4 rounded border-ui-border-medium accent-brand-secondary"
                  />
                  <span className="text-sm text-content-secondary">Activa</span>
                </label>
              </Field>
            )}

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
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear bolsa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
