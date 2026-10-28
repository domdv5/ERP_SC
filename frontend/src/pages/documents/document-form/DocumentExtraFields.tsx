import type { UseFormRegister } from 'react-hook-form'
import { DVV_REFUND_METHOD_OPTIONS } from '../document.constants'
import type { FormValues } from '../document-form.schema'

interface DocumentExtraFieldsProps {
  register: UseFormRegister<FormValues>
  docType: FormValues['type']
  needsAdjustmentReason: boolean
  currentAdjustmentReason: FormValues['adjustmentReason']
}

export function DocumentExtraFields({
  register,
  docType,
  needsAdjustmentReason,
  currentAdjustmentReason,
}: DocumentExtraFieldsProps) {
  return (
    <>
      {/* Modalidad de devolución — solo devoluciones en venta. Define si la devolución deja
          saldo a favor, es un cambio de producto, o se devuelve el dinero. */}
      {docType === 'DVV' && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-content-secondary">
            Modalidad de devolución <span className="text-red-500">*</span>
          </label>
          <select
            {...register('refundMethod')}
            className="input-hard w-full sm:w-72 px-3 py-2 text-sm text-content transition-all border-ui-border-medium"
          >
            <option value="">Selecciona una modalidad</option>
            {DVV_REFUND_METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Detalle del motivo — solo en entradas por ajuste cuando el motivo es "Otro" */}
      {needsAdjustmentReason && currentAdjustmentReason === 'otro' && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-content-secondary">
            Explica el motivo <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            maxLength={300}
            placeholder="Describe el motivo real del ajuste..."
            {...register('adjustmentReasonOther')}
            className="input-hard w-full px-3 py-2 text-sm border-ui-border-medium text-content placeholder:text-content-faint transition-all"
          />
        </div>
      )}

      {/* Notas */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-content-secondary">Notas</label>
        <textarea
          rows={2}
          {...register('notes')}
          placeholder="Observaciones opcionales..."
          className="input-hard w-full px-3 py-2 text-sm border-ui-border-medium text-content placeholder:text-content-faint transition-all resize-none"
        />
      </div>
    </>
  )
}
