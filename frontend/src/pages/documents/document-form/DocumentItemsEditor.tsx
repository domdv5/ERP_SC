import { Plus } from 'lucide-react'
import type { UseFieldArrayAppend, UseFormGetValues, UseFormSetValue } from 'react-hook-form'
import { BarcodeScanInput } from '../components/BarcodeScanInput'
import type { FormValues } from '../document-form.schema'
import { DocumentItemsTable } from './DocumentItemsTable'
import type { DocumentItems } from './useDocumentItems'

type TableProps = Parameters<typeof DocumentItemsTable>[0]

interface DocumentItemsEditorProps {
  docType: FormValues['type']
  typeFlags: TableProps['typeFlags']
  items: DocumentItems
  append: UseFieldArrayAppend<FormValues, 'items'>
  register: TableProps['register']
  control: TableProps['control']
  setValue: UseFormSetValue<FormValues>
  watch: TableProps['watch']
  getValues: UseFormGetValues<FormValues>
  selectedSupplierBrandIds: string[]
  tpSelectedName: string
}

export function DocumentItemsEditor({
  docType,
  typeFlags,
  items,
  append,
  register,
  control,
  setValue,
  watch,
  getValues,
  selectedSupplierBrandIds,
  tpSelectedName,
}: DocumentItemsEditorProps) {
  const {
    fields,
    remove,
    scannedProductInfo,
    setScannedProductInfo,
    quantityInputRefs,
    barcodeInputRef,
    setPendingQuantityFocusIndex,
  } = items

  return (
    <div className="card-hard overflow-hidden">
      <div className="px-6 py-4 border-b border-ui-divide flex items-center justify-between">
        <div>
          <h2 className="text-base text-content">Ítems</h2>
          <p className="text-xs text-content-faint font-accent mt-0.5">Mínimo 1 ítem requerido</p>
        </div>
        <button
          type="button"
          onClick={() =>
            append({
              productId: '',
              productCode: '',
              productDesc: '',
              quantity: 1,
              unitCost: undefined,
              unitPrice: undefined,
              observaciones: undefined,
              addedAt: new Date().toISOString(),
            })
          }
          className="btn-primary flex items-center gap-2 px-3 py-1.5 text-sm"
        >
          <Plus className="w-4 h-4" />
          Agregar ítem
        </button>
      </div>

      <BarcodeScanInput
        ref={barcodeInputRef}
        docType={docType}
        append={append}
        getValues={getValues}
        setValue={setValue}
        onProductScanned={(productId, avgCost, unitOfMeasure, availableStock) =>
          setScannedProductInfo((prev) => ({
            ...prev,
            [productId]: { avgCost, unitOfMeasure, availableStock },
          }))
        }
        focusQuantityInput={(index) => setPendingQuantityFocusIndex(index)}
        supplierBrandIds={typeFlags.needsSupplier ? selectedSupplierBrandIds : undefined}
        disabled={typeFlags.needsSupplier && !watch('thirdPartyId')}
        supplierName={tpSelectedName}
      />

      {fields.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-content-muted text-sm">No hay ítems. Agrega el primero.</p>
        </div>
      ) : (
        <DocumentItemsTable
          fields={fields}
          docType={docType}
          typeFlags={typeFlags}
          remove={remove}
          register={register}
          control={control}
          setValue={setValue}
          watch={watch}
          getValues={getValues}
          scannedProductInfo={scannedProductInfo}
          selectedSupplierBrandIds={selectedSupplierBrandIds}
          quantityInputRefs={quantityInputRefs}
          barcodeInputRef={barcodeInputRef}
        />
      )}
    </div>
  )
}
