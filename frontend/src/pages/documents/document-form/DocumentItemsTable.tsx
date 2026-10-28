import type {
  Control,
  FieldArrayWithId,
  UseFormGetValues,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form'
import { cn } from '@/lib/utils'
import { formatCOP } from '@/lib/format'
import { computeOfficialTotals } from '@/lib/tax'
import { ProductRow } from '../components/ProductRow'
import type { FormValues } from '../document-form.schema'
import type { DocumentTypeFlags } from './documentTypeFlags'
import type { ScannedProductInfo } from './useDocumentItems'

interface DocumentItemsTableProps {
  fields: FieldArrayWithId<FormValues, 'items'>[]
  docType: FormValues['type']
  typeFlags: Pick<
    DocumentTypeFlags,
    | 'needsSupplier'
    | 'showObservacionesColumn'
    | 'hasCostColumn'
    | 'showPriceColumn'
    | 'showCostColumn'
    | 'isOfficialPurchaseDoc'
    | 'showTimeColumn'
  >
  remove: (index: number) => void
  register: UseFormRegister<FormValues>
  control: Control<FormValues>
  setValue: UseFormSetValue<FormValues>
  watch: UseFormWatch<FormValues>
  getValues: UseFormGetValues<FormValues>
  scannedProductInfo: ScannedProductInfo
  selectedSupplierBrandIds: string[]
  quantityInputRefs: React.RefObject<Map<number, HTMLInputElement>>
  barcodeInputRef: React.RefObject<{ focus: () => void } | null>
}

export function DocumentItemsTable({
  fields,
  docType,
  typeFlags: {
    needsSupplier,
    showObservacionesColumn,
    hasCostColumn,
    showPriceColumn,
    showCostColumn,
    isOfficialPurchaseDoc,
    showTimeColumn,
  },
  remove,
  register,
  control,
  setValue,
  watch,
  getValues,
  scannedProductInfo,
  selectedSupplierBrandIds,
  quantityInputRefs,
  barcodeInputRef,
}: DocumentItemsTableProps) {
  const watchedItems = watch('items')
  // Totales de la compra oficial en vivo: IVA por línea redondeado como el backend.
  const officialTotals = computeOfficialTotals(
    (watchedItems ?? []).map((item) => ({
      quantity: Number(item.quantity || 0),
      unitValue: Number(item.unitCost || 0),
    })),
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ui-border">
            <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-3 py-3 min-w-[260px]">
              Producto
            </th>
            <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-3 py-3 w-28">
              Cantidad
            </th>
            {showObservacionesColumn && (
              <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-3 py-3 w-40">
                Observaciones
              </th>
            )}
            {hasCostColumn && (
              <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-3 py-3 w-36">
                {showPriceColumn ? 'Precio unit.' : 'Costo unit.'}{' '}
                {isOfficialPurchaseDoc && (
                  <span className="text-content-faint normal-case">(sin IVA)</span>
                )}
                {docType === 'EAI' && (
                  <span className="text-content-faint normal-case">(opc.)</span>
                )}
                {(docType === 'SAJ' || docType === 'T') && (
                  <span className="text-content-faint normal-case">(prom.)</span>
                )}
              </th>
            )}
            <th className="text-right text-xs font-semibold text-content-faint uppercase tracking-wider px-3 py-3 w-32">
              Subtotal
            </th>
            {isOfficialPurchaseDoc && (
              <th className="text-right text-xs font-semibold text-content-faint uppercase tracking-wider px-3 py-3 w-28">
                IVA 19%
              </th>
            )}
            {showTimeColumn && (
              <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-3 py-3 w-40">
                Hora
              </th>
            )}
            <th className="w-12" />
          </tr>
        </thead>
        <tbody className="divide-y divide-ui-divide">
          {fields.map((field, index) => (
            <ProductRow
              key={field.id}
              index={index}
              docType={docType}
              showTime={showTimeColumn}
              onRemove={() => remove(index)}
              register={register}
              control={control}
              setValue={setValue}
              watch={watch}
              getValues={getValues}
              initialAvgCost={scannedProductInfo[field.productId]?.avgCost}
              initialUnitOfMeasure={scannedProductInfo[field.productId]?.unitOfMeasure}
              initialAvailableStock={scannedProductInfo[field.productId]?.availableStock}
              supplierBrandIds={needsSupplier ? selectedSupplierBrandIds : undefined}
              quantityInputRef={(el) => {
                if (el) quantityInputRefs.current.set(index, el)
                else quantityInputRefs.current.delete(index)
              }}
              onQuantityConfirmed={() => barcodeInputRef.current?.focus()}
            />
          ))}
        </tbody>
        {isOfficialPurchaseDoc && fields.length > 0 && (
          <tfoot>
            {[
              { label: 'Subtotal', value: officialTotals.subtotal, strong: false },
              { label: 'IVA (19%)', value: officialTotals.taxTotal, strong: false },
              { label: 'Total', value: officialTotals.total, strong: true },
            ].map((row) => (
              <tr
                key={row.label}
                className={cn(
                  'bg-surface-raised',
                  row.label === 'Subtotal' && 'border-t border-ui-border',
                )}
              >
                <td colSpan={2} />
                <td className="px-3 py-2 text-right text-xs font-semibold text-content-faint uppercase tracking-wider">
                  {row.label}
                </td>
                <td
                  className={cn(
                    'px-3 py-2 text-right text-sm',
                    row.strong ? 'font-semibold text-content' : 'text-content-secondary',
                  )}
                >
                  {formatCOP(row.value)}
                </td>
                <td colSpan={2} />
              </tr>
            ))}
          </tfoot>
        )}
        {!isOfficialPurchaseDoc && (showCostColumn || showPriceColumn) && fields.length > 0 && (
          <tfoot>
            <tr className="border-t border-ui-border bg-surface-raised">
              <td colSpan={2} />
              <td className="px-3 py-3 text-right text-xs font-semibold text-content-faint uppercase tracking-wider">
                Total
              </td>
              <td className="px-3 py-3 text-right text-sm font-medium text-content-secondary">
                {formatCOP(
                  fields.reduce((sum, _, i) => {
                    const qty = Number(watch(`items.${i}.quantity`) ?? 0)
                    const price = showPriceColumn
                      ? Number(watch(`items.${i}.unitPrice`) ?? 0)
                      : Number(watch(`items.${i}.unitCost`) ?? 0)
                    return sum + qty * price
                  }, 0),
                )}
              </td>
              {showTimeColumn && <td />}
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
