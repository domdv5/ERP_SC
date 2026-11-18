import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

const MAX_REASON_LENGTH = 500

interface VoidEgresoDialogProps {
  open: boolean
  egresoLabel: string
  isPending: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export function VoidEgresoDialog({
  open,
  egresoLabel,
  isPending,
  onConfirm,
  onCancel,
}: VoidEgresoDialogProps) {
  const [reason, setReason] = useState('')
  if (!open) return null

  const trimmed = reason.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={isPending ? undefined : onCancel} />
      <div className="relative z-10 bg-surface rounded-2xl border-2 border-ui-border-medium shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base text-content mb-2">Anular egreso {egresoLabel}</h3>
            <p className="text-sm text-content-secondary leading-relaxed">
              Las facturas abonadas vuelven a quedar con su saldo y los saldos a favor usados
              vuelven a estar disponibles. Esto no devuelve dinero: si el pago sí salió del banco,
              regístralo de nuevo correctamente.
            </p>
            <label
              htmlFor="void-egreso-reason"
              className="block text-xs text-content-faint mt-4 mb-1.5"
            >
              Motivo
            </label>
            <textarea
              id="void-egreso-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MAX_REASON_LENGTH}
              rows={3}
              disabled={isPending}
              placeholder="¿Por qué se anula este egreso?"
              className="input-hard w-full text-sm border-ui-border-medium px-3 py-2 text-content resize-none"
            />
            <p className="text-xs text-content-faint text-right mt-1">
              {reason.length}/{MAX_REASON_LENGTH}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(trimmed)}
            disabled={isPending || trimmed.length === 0}
            className="btn-danger flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Anular egreso
          </button>
        </div>
      </div>
    </div>
  )
}
