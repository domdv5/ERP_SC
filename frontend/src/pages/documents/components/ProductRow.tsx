import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { Trash2, AlertTriangle, Copy } from 'lucide-react'
import { toast } from 'sonner'
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form'
import { Combobox } from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { getProducts } from '@/services/products.service'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/product.types'
import type { DocumentType } from '@/types/document.types'
import type { FormValues } from '@/pages/documents/document-form.schema'

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

// EAI re-pondera avgCost con lo que se escriba aquí — una desviación grande frente al costo
// promedio vigente suele ser un error de digitación (ej. falta un cero), no un costo real distinto.
const COST_DEVIATION_THRESHOLD = 0.3

interface ProductRowProps {
  index: number
  docType: DocumentType
  onRemove: () => void
  register: UseFormRegister<FormValues>
  setValue: UseFormSetValue<FormValues>
  watch: UseFormWatch<FormValues>
  errors: FieldErrors<FormValues>
  // Costo promedio ya conocido al momento de crear la fila (ej. vía escaneo de código de barras),
  // para que el warning de desviación EAI y la celda de solo lectura SAJ no queden vacíos solo
  // porque la fila no se creó a través del combobox de esta misma fila (ver onChange más abajo).
  initialAvgCost?: number
  // Unidad de medida ya conocida al momento de crear la fila (ej. vía escaneo de código de barras) —
  // mismo motivo que initialAvgCost: la fila no siempre pasa por el combobox propio, que es donde
  // normalmente se resuelve el producto y se llenaría este dato.
  initialUnitOfMeasure?: 'unidad' | 'docena'
}

export function ProductRow({ index, docType, onRemove, register, setValue, watch, errors, initialAvgCost, initialUnitOfMeasure }: ProductRowProps) {
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch] = useDebounce(productSearch, 400)
  // Costo promedio del producto al momento de seleccionarlo — solo para comparar contra lo digitado
  const [selectedAvgCost, setSelectedAvgCost] = useState<number | null>(() => initialAvgCost ?? null)
  // Unidad de medida del producto seleccionado — puramente informativa, ver hint en la columna Cantidad
  // para docType === 'T'. Nunca participa en ningún cálculo de cantidad/costo/stock.
  const [selectedUnitOfMeasure, setSelectedUnitOfMeasure] = useState<'unidad' | 'docena' | null>(
    () => initialUnitOfMeasure ?? null,
  )

  const productId   = watch(`items.${index}.productId`)
  const productCode = watch(`items.${index}.productCode`)
  const productDesc = watch(`items.${index}.productDesc`)
  const quantity    = watch(`items.${index}.quantity`) ?? 0
  const unitCost    = watch(`items.${index}.unitCost`) ?? 0

  const subtotal    = Number(quantity) * Number(unitCost)
  const showCost    = docType === 'CM' || docType === 'DVC' || docType === 'EAI'
  // SAJ nunca permite digitar el costo — el backend siempre usa el avgCost vigente del producto
  // (SajEffectStrategy). Aquí solo lo mostramos como referencia informativa, de solo lectura.
  const showCostReadonly = docType === 'SAJ'
  // SAJ no llena items.${index}.unitCost (no hay input ni autofill), así que el subtotal
  // basado en ese campo siempre daría 0 — se calcula aparte con el avgCost seleccionado.
  const readonlySubtotal = selectedAvgCost !== null ? Number(quantity) * selectedAvgCost : null
  const costOptional = docType === 'EAI'

  const costDeviation = selectedAvgCost && selectedAvgCost > 0 && Number(unitCost) > 0
    ? Math.abs(Number(unitCost) - selectedAvgCost) / selectedAvgCost
    : 0
  const showCostWarning = costOptional && costDeviation > COST_DEVIATION_THRESHOLD

  const hasSearch = debouncedProductSearch.length >= 1

  const { data: productData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-search', debouncedProductSearch],
    queryFn: () => getProducts({ search: debouncedProductSearch, page: 1, limit: 30 }),
    staleTime: 2 * 60 * 1000,
    enabled: hasSearch,
  })

  const productOptions: ComboboxOption[] = (productData?.items ?? []).map((p: Product) => ({
    id: p.id,
    label: `${p.code} — ${p.description}`,
    sublabel: `Costo prom: ${formatCOP(Number(p.avgCost))}`,
  }))

  const displayOptions: ComboboxOption[] = productId && !hasSearch
    ? [{ id: productId, label: `${productCode} — ${productDesc}` }]
    : productOptions

  const rowErrors = errors.items?.[index]

  const handleCopyAvgCost = async () => {
    if (selectedAvgCost === null) return
    try {
      // Valor numérico crudo (sin formatear) — se pega directo en el input de costo del EAI de destino.
      await navigator.clipboard.writeText(String(selectedAvgCost))
      toast.success('Costo copiado')
    } catch {
      toast.error('No se pudo copiar el costo')
    }
  }

  return (
    <tr className="group">
      {/* Product combobox */}
      <td className="px-3 py-2 min-w-[260px]">
        <Combobox
          value={productId ?? ''}
          onChange={(id) => {
            const product = productData?.items.find((p: Product) => p.id === id)
            setValue(`items.${index}.productId`, id)
            setValue(`items.${index}.productCode`, product?.code ?? '')
            setValue(`items.${index}.productDesc`, product?.description ?? '')
            setSelectedAvgCost(product?.avgCost ? Number(product.avgCost) : null)
            setSelectedUnitOfMeasure(product?.unitOfMeasure ?? null)
            if (showCost && product?.avgCost) {
              setValue(`items.${index}.unitCost`, Number(product.avgCost))
            }
          }}
          options={displayOptions}
          isLoading={isLoadingProducts}
          placeholder="Selecciona un producto..."
          searchValue={productSearch}
          onSearchChange={setProductSearch}
          error={rowErrors?.productId?.message}
        />
        {rowErrors?.productId && (
          <p className="text-xs text-red-500 mt-1">{rowErrors.productId.message}</p>
        )}
        <input type="hidden" {...register(`items.${index}.productId`)} />
        <input type="hidden" {...register(`items.${index}.productCode`)} />
        <input type="hidden" {...register(`items.${index}.productDesc`)} />
      </td>

      {/* Quantity */}
      <td className="px-3 py-2 w-28">
        <input
          type="number"
          min={1}
          step={1}
          {...register(`items.${index}.quantity`)}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content',
            'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all',
            rowErrors?.quantity ? 'border-red-500' : 'border-ui-border-medium',
          )}
        />
        {rowErrors?.quantity && (
          <p className="text-xs text-red-500 mt-1">{rowErrors.quantity.message}</p>
        )}
        {!rowErrors?.quantity && docType === 'T' && selectedUnitOfMeasure === 'docena' && (
          <p className="text-xs text-content-faint mt-1">Se maneja por docena</p>
        )}
      </td>

      {/* Unit cost */}
      {showCost && (
        <td className="px-3 py-2 w-36">
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder={costOptional ? 'Costo promedio' : undefined}
            {...register(`items.${index}.unitCost`)}
            className={cn(
              'w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content placeholder:text-content-faint',
              'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all',
              rowErrors?.unitCost ? 'border-red-500' : 'border-ui-border-medium',
            )}
          />
          {rowErrors?.unitCost && (
            <p className="text-xs text-red-500 mt-1">{rowErrors.unitCost.message}</p>
          )}
          {!rowErrors?.unitCost && showCostWarning && (
            <p className="flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400 mt-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Se aleja del costo prom. ({formatCOP(selectedAvgCost!)})
            </p>
          )}
        </td>
      )}

      {/* Unit cost — read-only for SAJ: backend always uses the product's current avgCost */}
      {showCostReadonly && (
        <td className="px-3 py-2 w-36">
          <span className="inline-flex items-center gap-1 text-sm text-content-muted">
            {selectedAvgCost !== null ? (
              <>
                {`Costo: ${formatCOP(selectedAvgCost)}`}
                <button
                  type="button"
                  onClick={handleCopyAvgCost}
                  aria-label="Copiar costo"
                  className="p-1 rounded-lg text-content-faint hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <span className="text-content-faint">—</span>
            )}
          </span>
        </td>
      )}

      {/* Subtotal */}
      <td className="px-3 py-2 w-32 text-right">
        <span className="text-sm text-content-secondary font-medium">
          {showCost
            ? formatCOP(subtotal)
            : showCostReadonly && readonlySubtotal !== null
              ? formatCOP(readonlySubtotal)
              : '—'}
        </span>
      </td>

      {/* Remove */}
      <td className="px-3 py-2 w-12 text-center">
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-lg text-content-faint hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  )
}
