import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, PiggyBank } from 'lucide-react'

import { createExcedente } from '@/services/accounts-receivable.service'
import { ThousandsInput } from '@/components/shared'
import { useCustomerBranches } from '@/hooks/useCustomerBranches'
import { todayInBogota } from '@/lib/format'

const NO_BRANCH = 'none'

interface RegisterExcedenteModalProps {
  open: boolean
  clientId: string
  // Sucursal preseleccionada (la del filtro o la del recibo); '' si no hay
  defaultBranchId?: string
  onClose: () => void
  onCreated?: () => void
}

function extractErrorMessage(err: unknown): string | undefined {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  return typeof message === 'string' ? message : undefined
}

export function RegisterExcedenteModal(props: RegisterExcedenteModalProps) {
  if (!props.open) return null
  return <RegisterExcedenteForm {...props} />
}

function RegisterExcedenteForm({
  clientId,
  defaultBranchId = '',
  onClose,
  onCreated,
}: RegisterExcedenteModalProps) {
  const queryClient = useQueryClient()
  const { branches, isLoading: isLoadingBranches } = useCustomerBranches(clientId)
  const hasBranches = branches.length > 0

  const [branchId, setBranchId] = useState(defaultBranchId)
  const [amount, setAmount] = useState<number | undefined>(undefined)
  const [date, setDate] = useState(todayInBogota())
  const [error, setError] = useState<string | null>(null)
  // Se marca al instante, antes de que React redibuje el botón deshabilitado: un doble clic rápido no crea dos excedentes
  const isSubmittingRef = useRef(false)

  const { mutateAsync, isPending } = useMutation({
    mutationFn: () =>
      createExcedente(clientId, {
        customerBranchId: hasBranches && branchId && branchId !== NO_BRANCH ? branchId : undefined,
        amount: amount ?? 0,
        date,
      }),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (hasBranches && !branchId) return setError('Selecciona una sucursal')
    if (!amount || amount <= 0) return setError('El valor debe ser mayor que 0')
    if (!date) return setError('La fecha es requerida')
    if (date > todayInBogota()) return setError('La fecha no puede ser futura')
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setError(null)

    try {
      await mutateAsync()
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] })
      queryClient.invalidateQueries({ queryKey: ['recibos-caja-open-items', clientId] })
      toast.success('Excedente registrado correctamente')
      onCreated?.()
      onClose()
    } catch (err) {
      toast.error(extractErrorMessage(err) ?? 'Error al registrar el excedente')
    } finally {
      isSubmittingRef.current = false
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={isPending ? undefined : onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 bg-surface rounded-2xl border-2 border-ui-border-medium shadow-2xl p-6 w-full max-w-md mx-4"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center selected-ink shrink-0 mt-0.5">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base text-content mb-1">Registrar excedente</h3>
            <p className="text-sm text-content-secondary leading-relaxed">
              Saldo a favor del cliente por un pago de más. Solo se puede usar en recibos de caja.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {isLoadingBranches ? (
            <div className="h-10 rounded-md bg-surface-hover animate-pulse" />
          ) : (
            hasBranches && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-content-secondary">
                  Sucursal <span className="text-red-500">*</span>
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="input-hard w-full px-3 py-2 text-sm text-content transition-all border-ui-border-medium"
                >
                  <option value="">Selecciona una sucursal...</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                  <option value={NO_BRANCH}>Sin sucursal</option>
                </select>
              </div>
            )
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-content-secondary">
              Valor <span className="text-red-500">*</span>
            </label>
            <ThousandsInput value={amount} onChange={setAmount} placeholder="0" autoFocus />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-content-secondary">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              max={todayInBogota()}
              onChange={(e) => setDate(e.target.value)}
              className="input-hard w-full px-3 py-2 text-sm text-content transition-all border-ui-border-medium"
            />
          </div>

          {error && <p className="text-xs text-red-500 font-accent">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar excedente
          </button>
        </div>
      </form>
    </div>
  )
}
