import { Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  FieldArrayWithId,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormReturn,
} from 'react-hook-form'
import { toast } from 'sonner'
import type { FormValues } from '@/pages/documents/document-form.schema'
import { BarcodeScanInput } from '@/pages/documents/components/BarcodeScanInput'
import { POSCartLine } from '@/pages/documents/components/POSCartLine'
import type { DocumentType } from '@/types/document.types'
import type { Product } from '@/types/product.types'

interface SaleCartProps {
  docType: DocumentType
  official: boolean
  form: Pick<UseFormReturn<FormValues>, 'control' | 'register' | 'watch' | 'setValue' | 'getValues'>
  fields: FieldArrayWithId<FormValues, 'items'>[]
  append: UseFieldArrayAppend<FormValues, 'items'>
  remove: UseFieldArrayRemove
  cartItems: FormValues['items']
  productDetailByCode: Map<string, { minSalePrice: number; availableStock: number; id: string }>
  minSalePriceByProductId: Map<string, number>
}

export function SaleCart({
  docType,
  official,
  form,
  fields,
  append,
  remove,
  cartItems,
  productDetailByCode,
  minSalePriceByProductId,
}: SaleCartProps) {
  const queryClient = useQueryClient()
  const { control, register, watch, setValue, getValues } = form

  // ── producto elegido a mano en una fila vacía (alternativa al escaneo) ────
  function handleRowProductSelect(index: number, product: Product) {
    // Deja el producto ya conocido en la caché de búsqueda por código, para no volver a pedir
    // al servidor el precio mínimo y el disponible de esta misma fila.
    queryClient.setQueryData(['product-by-code', product.code], product)

    const currentItems = getValues('items')
    const existingIndex = currentItems.findIndex(
      (item, i) => item.productId === product.id && i !== index,
    )
    if (existingIndex >= 0) {
      // Igual que el escaneo: suma en la fila existente y descarta la vacía.
      const rowQty = Number(currentItems[index].quantity) || 1
      const existingQty = Number(currentItems[existingIndex].quantity) || 0
      setValue(`items.${existingIndex}.quantity`, existingQty + rowQty)
      setValue(`items.${existingIndex}.addedAt`, new Date().toISOString())
      remove(index)
      toast.success(`${product.code} ya estaba en el carrito — cantidad sumada`)
      return
    }

    setValue(`items.${index}.productId`, product.id)
    setValue(`items.${index}.productCode`, product.code)
    setValue(`items.${index}.productDesc`, product.description)
    setValue(`items.${index}.unitPrice`, Number(product.salePrice))
    setValue(`items.${index}.addedAt`, new Date().toISOString())
  }

  return (
    <div className="card-hard overflow-hidden">
      <div className="px-6 py-4 border-b border-ui-divide flex items-center justify-between">
        <div>
          <h2 className="text-base text-content">Productos</h2>
          <p className="text-xs text-content-faint font-accent mt-0.5">
            Escanea o busca para agregar
          </p>
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
        docType={docType}
        append={append}
        getValues={getValues}
        setValue={setValue}
        onProductScanned={() => {}}
        focusQuantityInput={() => {}}
        supplierBrandIds={undefined}
      />

      {fields.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-content-muted text-sm">
            El carrito está vacío. Escanea o busca un producto.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ui-border">
                <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3">
                  Producto
                </th>
                <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3 w-24">
                  Cant.
                </th>
                <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3 w-32">
                  Precio unit.{' '}
                  {official && <span className="text-content-faint normal-case">(con IVA)</span>}
                </th>
                <th className="text-right text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3 w-32">
                  Subtotal
                </th>
                {official && (
                  <th className="text-right text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3 w-28">
                    IVA 19%
                  </th>
                )}
                <th className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3 w-40">
                  Hora
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ui-divide">
              {fields.map((field, index) => {
                const code = cartItems[index]?.productCode
                const detail = code ? productDetailByCode.get(code) : undefined
                return (
                  <POSCartLine
                    key={field.id}
                    index={index}
                    register={register}
                    control={control}
                    watch={watch}
                    onRemove={() => remove(index)}
                    onProductSelect={(product) => handleRowProductSelect(index, product)}
                    minSalePrice={detail && minSalePriceByProductId.get(detail.id)}
                    availableStock={official ? undefined : detail?.availableStock}
                    showTax={official}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
