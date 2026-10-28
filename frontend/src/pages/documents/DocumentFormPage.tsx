import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { todayInBogota } from '@/lib/format'
import { getFirstErrorMessage } from '@/lib/form-errors'
import { formSchema, type FormValues } from './document-form.schema'
import { EAI_ADJUSTMENT_REASON_OPTIONS } from './document.constants'
import { DocumentExtraFields } from './document-form/DocumentExtraFields'
import { DocumentFormHeader } from './document-form/DocumentFormHeader'
import { DocumentItemsEditor } from './document-form/DocumentItemsEditor'
import { DocumentTypeField } from './document-form/DocumentTypeField'
import { OfficialInvoiceFields } from './document-form/OfficialInvoiceFields'
import { PartyFields } from './document-form/PartyFields'
import { TransferFields } from './document-form/TransferFields'
import { getDocumentTypeFlags } from './document-form/documentTypeFlags'
import { typeLabelFor } from './document-form/documentTypeLabels'
import { useDocumentFormType } from './document-form/useDocumentFormType'
import { useDocumentItems } from './document-form/useDocumentItems'
import { useDocumentParties } from './document-form/useDocumentParties'
import { useExistingDocument } from './document-form/useExistingDocument'
import { useOfficialPurchasePrefill } from './document-form/useOfficialPurchasePrefill'
import { useSaveDocument } from './document-form/useSaveDocument'
import { useTransferLocations } from './document-form/useTransferLocations'

import type { DocumentSourceRef } from '@/types/document.types'

export default function DocumentFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEditing = Boolean(id)

  const { availableTypes, defaultType } = useDocumentFormType(isEditing)

  // CM oficial de la que se precarga la compra oficial (bandeja); solo aplica a CMO nueva.
  const fromCMId = searchParams.get('fromCM')
  const [sourceRef, setSourceRef] = useState<DocumentSourceRef | null>(null)

  const { control, register, handleSubmit, watch, setValue, getValues, reset } =
    useForm<FormValues>({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolver: zodResolver(formSchema) as any,
      defaultValues: {
        type: defaultType,
        date: todayInBogota(),
        items: [],
      },
    })

  const items = useDocumentItems(control)
  const { append, replace, setScannedProductInfo } = items

  const docType = watch('type')
  const typeFlags = getDocumentTypeFlags(docType)
  const { accent, needsCustomer, isTodayOnly, needsTransfer, needsAdjustmentReason } = typeFlags

  const parties = useDocumentParties(watch, typeFlags)
  const { customerBranches, isLoadingBranches } = parties

  const { isLoadingDoc } = useExistingDocument({
    id,
    isEditing,
    reset,
    parties,
    setSourceRef,
    setScannedProductInfo,
  })

  useOfficialPurchasePrefill({
    isEditing,
    docType,
    fromCMId,
    setValue,
    replace,
    parties,
    setSourceRef,
    setScannedProductInfo,
  })

  const transfer = useTransferLocations(docType, watch, setValue)

  const { onSubmit, isPending } = useSaveDocument({
    id,
    isEditing,
    needsCustomer,
    customerBranchCount: customerBranches.length,
    isLoadingBranches,
  })

  if (isEditing && isLoadingDoc) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-hover animate-pulse" />
          <div className="w-48 h-7 rounded-lg bg-surface-hover animate-pulse" />
        </div>
        <div className="bg-surface rounded-2xl border border-ui-border p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-hover animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const goBack = () => navigate(isEditing ? `/documents/${id}` : '/documents')
  const currentAdjustmentReason = watch('adjustmentReason')
  const isOfficialPurchase = docType === 'CM' && Boolean(watch('officialPurchase'))

  return (
    <div className="space-y-6 pb-10">
      <DocumentFormHeader docType={docType} isEditing={isEditing} onBack={goBack} />

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form
        onSubmit={handleSubmit(onSubmit as any, (formErrors) =>
          toast.error(getFirstErrorMessage(formErrors)),
        )}
        noValidate
        className="space-y-6"
      >
        {/* ── Datos generales — borde de acento izquierdo según el tipo, ancla visual del form ── */}
        <div className={cn('card-hard p-6 space-y-5 border-l-[6px]', accent.border)}>
          <h2 className="text-base text-content border-b border-ui-divide pb-3">
            Información general
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <DocumentTypeField
              control={control}
              setValue={setValue}
              replace={replace}
              typeFlags={typeFlags}
              availableTypes={availableTypes}
              isEditing={isEditing}
              onClearSelections={parties.clearSelections}
            />

            {/* Fecha */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-content-secondary">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('date')}
                readOnly={isTodayOnly}
                className={cn(
                  'input-hard w-full px-3 py-2 text-sm text-content transition-all border-ui-border-medium',
                  isTodayOnly && 'opacity-60 cursor-not-allowed',
                )}
              />
            </div>

            <PartyFields
              control={control}
              setValue={setValue}
              getValues={getValues}
              replace={replace}
              docType={docType}
              typeFlags={typeFlags}
              parties={parties}
              setSourceRef={setSourceRef}
            />

            {needsTransfer && (
              <TransferFields control={control} setValue={setValue} transfer={transfer} />
            )}

            {/* Motivo del ajuste (solo entradas por ajuste) */}
            {needsAdjustmentReason && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-content-secondary">
                  Motivo del ajuste <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('adjustmentReason')}
                  className="input-hard w-full px-3 py-2 text-sm text-content transition-all border-ui-border-medium"
                >
                  <option value="">Selecciona un motivo</option>
                  {EAI_ADJUSTMENT_REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <OfficialInvoiceFields
            register={register}
            docType={docType}
            isOfficialPurchase={isOfficialPurchase}
            sourceRef={sourceRef}
          />

          <DocumentExtraFields
            register={register}
            docType={docType}
            needsAdjustmentReason={needsAdjustmentReason}
            currentAdjustmentReason={currentAdjustmentReason}
          />
        </div>

        {/* ── Editor de ítems ──────────────────────────────────────────── */}
        <DocumentItemsEditor
          docType={docType}
          typeFlags={typeFlags}
          items={items}
          append={append}
          register={register}
          control={control}
          setValue={setValue}
          watch={watch}
          getValues={getValues}
          selectedSupplierBrandIds={parties.selectedSupplierBrandIds}
          tpSelectedName={parties.tpSelectedName}
        />

        {/* ── Acciones ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={goBack} className="btn-secondary px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-60"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Guardar cambios' : `Crear ${typeLabelFor(docType)}`}
          </button>
        </div>
      </form>
    </div>
  )
}
