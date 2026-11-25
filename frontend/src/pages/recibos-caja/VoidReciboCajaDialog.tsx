import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { RECIBO_CAJA_VOID_REASON_LABELS } from '@/types'
import type { ReciboCajaVoidReason } from '@/types'

const MAX_REASON_LENGTH = 500

const REASON_OPTIONS = Object.entries(RECIBO_CAJA_VOID_REASON_LABELS) as [
  ReciboCajaVoidReason,
  string,
][]

interface VoidReciboCajaDialogProps {
  open: boolean
  reciboLabel: string
  isPending: boolean
  onConfirm: (vars: { reason: ReciboCajaVoidReason; reasonOther?: string }) => void
  onCancel: () => void
}

export function VoidReciboCajaDialog({
  open,
  reciboLabel,
  isPending,
  onConfirm,
  onCancel,
}: VoidReciboCajaDialogProps) {
  const [reason, setReason] = useState<ReciboCajaVoidReason | ''>('')
  const [reasonOther, setReasonOther] = useState('')
  if (!open) return null

  const trimmed = reasonOther.trim()
  const isOther = reason === 'otro'
  const canConfirm = reason !== '' && (!isOther || trimmed.length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={isPending ? undefined : onCancel} />
      <div className="relative z-10 bg-surface rounded-2xl border-2 border-ui-border-medium shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base text-content mb-2">Anular recibo de caja {reciboLabel}</h3>
            <p className="text-sm text-content-secondary leading-relaxed">
              Las facturas cobradas vuelven a quedar con su saldo pendiente y los saldos a favor
              usados vuelven a estar disponibles. Esto no devuelve dinero: el sistema no lleva la
              caja, así que si ya recibiste el dinero, debes devolverlo aparte.
            </p>
            <label
              htmlFor="void-recibo-caja-reason"
              className="block text-xs text-content-faint mt-4 mb-1.5"
            >
              Motivo
            </label>
            <select
              id="void-recibo-caja-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReciboCajaVoidReason | '')}
              disabled={isPending}
              className="input-hard w-full px-3 py-2 text-sm text-content border-ui-border-medium"
            >
              <option value="">Elige un motivo</option>
              {REASON_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {isOther && (
              <>
                <textarea
                  aria-label="Escribe el motivo"
                  value={reasonOther}
                  onChange={(e) => setReasonOther(e.target.value)}
                  maxLength={MAX_REASON_LENGTH}
                  rows={3}
                  disabled={isPending}
                  placeholder="Escribe el motivo"
                  className="input-hard w-full text-sm border-ui-border-medium px-3 py-2 text-content resize-none mt-3"
                />
                <p className="text-xs text-content-faint text-right mt-1">
                  {reasonOther.length}/{MAX_REASON_LENGTH}
                </p>
              </>
            )}
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
            onClick={() => {
              if (reason === '') return
              onConfirm(isOther ? { reason, reasonOther: trimmed } : { reason })
            }}
            disabled={isPending || !canConfirm}
            className="btn-danger flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Anular recibo de caja
          </button>
        </div>
      </div>
    </div>
  )
}
