import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { DOCUMENT_VOID_REASON_LABELS } from '@/types'
import type { DocumentType, DocumentVoidReason } from '@/types'
import type { VoidDocumentPayload } from '@/services/documents.service'
import {
  MAX_VOID_REASON_LENGTH,
  buildVoidPayload,
  getVoidReasonsForType,
} from './void-document.utils'

interface VoidDocumentDialogProps {
  open: boolean
  type: DocumentType
  description: string
  isPending: boolean
  onConfirm: (body: VoidDocumentPayload) => void
  onCancel: () => void
}

export function VoidDocumentDialog({ open, ...props }: VoidDocumentDialogProps) {
  if (!open) return null
  return <VoidDocumentDialogContent {...props} />
}

function VoidDocumentDialogContent({
  type,
  description,
  isPending,
  onConfirm,
  onCancel,
}: Omit<VoidDocumentDialogProps, 'open'>) {
  const [reason, setReason] = useState<DocumentVoidReason | ''>('')
  const [reasonOther, setReasonOther] = useState('')

  const allowedReasons = getVoidReasonsForType(type)
  const payload = allowedReasons ? buildVoidPayload(reason, reasonOther) : {}
  const isOther = reason === 'otro'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={isPending ? undefined : onCancel} />
      <div className="relative z-10 bg-surface rounded-2xl border-2 border-ui-border-medium shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/15 shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base text-content mb-2">Anular operación</h3>
            <p className="text-sm text-content-secondary leading-relaxed">{description}</p>
            {allowedReasons && (
              <>
                <label
                  htmlFor="void-document-reason"
                  className="block text-xs text-content-faint mt-4 mb-1.5"
                >
                  Motivo
                </label>
                <select
                  id="void-document-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as DocumentVoidReason | '')}
                  disabled={isPending}
                  className="input-hard w-full px-3 py-2 text-sm text-content border-ui-border-medium"
                >
                  <option value="">Elige un motivo</option>
                  {allowedReasons.map((value) => (
                    <option key={value} value={value}>
                      {DOCUMENT_VOID_REASON_LABELS[value]}
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
            onClick={() => payload && onConfirm(payload)}
            disabled={isPending || !payload}
            className="btn-danger flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Anular operación
          </button>
        </div>
      </div>
    </div>
  )
}
