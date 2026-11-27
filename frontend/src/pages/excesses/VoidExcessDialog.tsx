import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { ExcessVoidReason, VoidExcessBody } from '@contracts/excesses'
import { canConfirmVoid, MAX_VOID_REASON_LENGTH, VOID_REASON_LABELS } from './excess.rules'

const REASON_OPTIONS = Object.entries(VOID_REASON_LABELS) as [ExcessVoidReason, string][]

interface VoidExcessDialogProps {
  excessLabel: string
  isPending: boolean
  onConfirm: (body: VoidExcessBody) => void
  onCancel: () => void
}

export function VoidExcessDialog({
  excessLabel,
  isPending,
  onConfirm,
  onCancel,
}: VoidExcessDialogProps) {
  const [reason, setReason] = useState<ExcessVoidReason | ''>('')
  const [reasonOther, setReasonOther] = useState('')

  const isOther = reason === 'otro'
  const trimmed = reasonOther.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={isPending ? undefined : onCancel} />
      <div className="relative z-10 bg-surface rounded-2xl border-2 border-ui-border-medium shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base text-content mb-2">Anular excedente {excessLabel}</h3>
            <p className="text-sm text-content-secondary leading-relaxed">
              El excedente queda marcado como anulado y ya no se podrá usar. Esta acción no se puede
              deshacer.
            </p>
            <label
              htmlFor="void-excess-reason"
              className="block text-xs text-content-faint mt-4 mb-1.5"
            >
              Motivo
            </label>
            <select
              id="void-excess-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ExcessVoidReason | '')}
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
                  maxLength={MAX_VOID_REASON_LENGTH}
                  rows={3}
                  disabled={isPending}
                  placeholder="Escribe el motivo"
                  className="input-hard w-full text-sm border-ui-border-medium px-3 py-2 text-content resize-none mt-3"
                />
                <p className="text-xs text-content-faint text-right mt-1">
                  {reasonOther.length}/{MAX_VOID_REASON_LENGTH}
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
            disabled={isPending || !canConfirmVoid(reason, reasonOther)}
            className="btn-danger flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Anular excedente
          </button>
        </div>
      </div>
    </div>
  )
}
