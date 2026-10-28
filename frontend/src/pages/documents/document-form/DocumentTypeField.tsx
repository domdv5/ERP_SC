import {
  Controller,
  type Control,
  type UseFieldArrayReplace,
  type UseFormSetValue,
} from 'react-hook-form'
import { cn } from '@/lib/utils'
import type { operationFormTypes } from '../document.constants'
import type { FormValues } from '../document-form.schema'
import type { DocumentTypeFlags } from './documentTypeFlags'

interface DocumentTypeFieldProps {
  control: Control<FormValues>
  setValue: UseFormSetValue<FormValues>
  replace: UseFieldArrayReplace<FormValues, 'items'>
  typeFlags: Pick<DocumentTypeFlags, 'accent' | 'isFixedType' | 'fixedTypeLabel'>
  availableTypes: ReturnType<typeof operationFormTypes>
  isEditing: boolean
  onClearSelections: () => void
}

// Tipo — la remisión y la devolución en venta van con tipo fijo (no editable); el resto usa el desplegable
export function DocumentTypeField({
  control,
  setValue,
  replace,
  typeFlags: { accent, isFixedType, fixedTypeLabel },
  availableTypes,
  isEditing,
  onClearSelections,
}: DocumentTypeFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-content-secondary">
        Tipo de operación {!isFixedType && <span className="text-red-500">*</span>}
      </label>
      {isFixedType ? (
        <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-ui-border-medium bg-surface-raised text-content opacity-90">
          <span
            className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
              accent.iconBg,
            )}
          >
            <accent.icon className={cn('w-4 h-4', accent.iconText)} />
          </span>
          {fixedTypeLabel}
        </div>
      ) : (
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              disabled={isEditing}
              onChange={(e) => {
                field.onChange(e)
                setValue('thirdPartyId', undefined)
                setValue('sellerId', undefined)
                setValue('receiverId', undefined)
                setValue('warehouseId', undefined)
                setValue('sourceBinId', undefined)
                setValue('destWarehouseId', undefined)
                setValue('destBinId', undefined)
                setValue('adjustmentReason', undefined)
                setValue('adjustmentReasonOther', undefined)
                setValue('officialPurchase', false)
                setValue('supplierInvoiceNumber', undefined)
                onClearSelections()
                replace([])
              }}
              className={cn(
                'input-hard w-full px-3 py-2 text-sm text-content transition-all',

                isEditing ? 'opacity-60 cursor-not-allowed' : 'border-ui-border-medium',
              )}
            >
              {availableTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        />
      )}
    </div>
  )
}
