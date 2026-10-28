import {
  Controller,
  type Control,
  type UseFieldArrayReplace,
  type UseFormGetValues,
  type UseFormSetValue,
} from 'react-hook-form'
import { Info } from 'lucide-react'
import { Combobox, CustomerBranchSelect } from '@/components/shared'
import type { DocumentSourceRef } from '@/types/document.types'
import type { FormValues } from '../document-form.schema'
import type { DocumentTypeFlags } from './documentTypeFlags'
import type { DocumentParties } from './useDocumentParties'

interface PartyFieldsProps {
  control: Control<FormValues>
  setValue: UseFormSetValue<FormValues>
  getValues: UseFormGetValues<FormValues>
  replace: UseFieldArrayReplace<FormValues, 'items'>
  docType: FormValues['type']
  typeFlags: Pick<
    DocumentTypeFlags,
    'needsThirdParty' | 'needsCustomer' | 'needsSupplier' | 'needsSeller' | 'needsReceiver'
  >
  parties: DocumentParties
  setSourceRef: (ref: DocumentSourceRef | null) => void
}

export function PartyFields({
  control,
  setValue,
  getValues,
  replace,
  docType,
  typeFlags: { needsThirdParty, needsCustomer, needsSupplier, needsSeller, needsReceiver },
  parties,
  setSourceRef,
}: PartyFieldsProps) {
  const {
    tpSearch,
    setTpSearch,
    setTpSelectedName,
    isLoadingTp,
    tpDisplayOptions,
    currentTpId,
    findThirdParty,
    customerBranches,
    isLoadingBranches,
    setSelectedSupplierBrandIds,
    selectedSupplierDiscountNotes,
    setSelectedSupplierDiscountNotes,
    sellerSearch,
    setSellerSearch,
    setSellerSelectedName,
    isLoadingSeller,
    sellerDisplayOptions,
    receiverSearch,
    setReceiverSearch,
    setReceiverSelectedName,
    isLoadingReceiver,
    receiverDisplayOptions,
  } = parties

  return (
    <>
      {/* Tercero — proveedor en compras y devoluciones, cliente en preventas y remisiones */}
      {needsThirdParty && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-content-secondary">
            {needsCustomer ? 'Cliente' : 'Proveedor'} <span className="text-red-500">*</span>
          </label>
          <Controller
            name="thirdPartyId"
            control={control}
            render={({ field }) => (
              <Combobox
                value={field.value ?? ''}
                onChange={(selectedId, option) => {
                  field.onChange(selectedId)
                  setTpSelectedName(option.label)
                  setValue('customerBranchId', undefined)

                  const tp = findThirdParty(selectedId)
                  setSelectedSupplierBrandIds(tp?.supplier?.brands.map((b) => b.id) ?? [])
                  setSelectedSupplierDiscountNotes(tp?.supplier?.discountNotes ?? undefined)

                  // El backend exige mismo proveedor entre la CMO y su CM origen: cambiar de proveedor suelta el vínculo.
                  if (docType === 'CMO' && getValues('sourceDocumentId')) {
                    setValue('sourceDocumentId', undefined)
                    setSourceRef(null)
                  }

                  // Cambiar de proveedor invalida la marca de los ítems ya cargados y los vacía; en PV/REM (sin filtro de marca) no aplica.
                  if (needsSupplier && getValues('items').length > 0) {
                    replace([])
                  }
                }}
                options={tpDisplayOptions}
                isLoading={isLoadingTp}
                placeholder={
                  needsCustomer ? 'Selecciona un cliente...' : 'Selecciona un proveedor...'
                }
                searchValue={tpSearch}
                onSearchChange={setTpSearch}
              />
            )}
          />
          {docType === 'CM' && selectedSupplierDiscountNotes && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium">Condiciones de descuento</p>
                <p className="font-accent mt-0.5 whitespace-pre-wrap">
                  {selectedSupplierDiscountNotes}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {needsCustomer && currentTpId && (
        <Controller
          name="customerBranchId"
          control={control}
          render={({ field }) => (
            <CustomerBranchSelect
              branches={customerBranches}
              value={field.value ?? ''}
              onChange={field.onChange}
              isLoading={isLoadingBranches}
            />
          )}
        />
      )}

      {/* Vendedora — solo preventas y remisiones */}
      {needsSeller && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-content-secondary">
            Vendedora <span className="text-red-500">*</span>
          </label>
          <Controller
            name="sellerId"
            control={control}
            render={({ field }) => (
              <Combobox
                value={field.value ?? ''}
                onChange={(selectedId, option) => {
                  field.onChange(selectedId)
                  setSellerSelectedName(option.label)
                }}
                options={sellerDisplayOptions}
                isLoading={isLoadingSeller}
                placeholder="Selecciona una vendedora..."
                searchValue={sellerSearch}
                onSearchChange={setSellerSearch}
              />
            )}
          />
        </div>
      )}

      {/* Recibido por — solo compras */}
      {needsReceiver && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-content-secondary">
            Recibido por <span className="text-red-500">*</span>
          </label>
          <Controller
            name="receiverId"
            control={control}
            render={({ field }) => (
              <Combobox
                value={field.value ?? ''}
                onChange={(selectedId, option) => {
                  field.onChange(selectedId)
                  setReceiverSelectedName(option.label)
                }}
                options={receiverDisplayOptions}
                isLoading={isLoadingReceiver}
                placeholder="Selecciona quién recibió la mercancía..."
                searchValue={receiverSearch}
                onSearchChange={setReceiverSearch}
              />
            )}
          />
        </div>
      )}
    </>
  )
}
