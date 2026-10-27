import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { Trash2 } from 'lucide-react'
import { Controller, type Control, type UseFormRegister, type UseFormWatch } from 'react-hook-form'
import { Combobox, HintText, ThousandsInput } from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { getProducts } from '@/services/products.service'
import { formatCOP, formatDateTimeBogota } from '@/lib/format'
import { computeOfficialLineTax } from '@/lib/tax'
import { cn } from '@/lib/utils'
import type { FormValues } from '@/pages/documents/document-form.schema'
import type { Product } from '@/types/product.types'

interface POSCartLineProps {
  index: number
  register: UseFormRegister<FormValues>
  control: Control<FormValues>
  watch: UseFormWatch<FormValues>
  onRemove: () => void
  // La pantalla decide qué hacer con el producto elegido en una fila vacía (precio, duplicados).
  onProductSelect: (product: Product) => void
  // Precio mínimo actual del producto (piso del 2%). Lo resuelve la pantalla de checkout al
  // entrar el código al carrito. Viene sin valor mientras ese dato todavía no llegó.
  minSalePrice?: number
  // Disponible ya neteado; solo informativo, es un aviso temprano y el backend rechaza al confirmar si de verdad no alcanza.
  availableStock?: number
  // Venta oficial: agrega la columna con el IVA 19% de la línea (el precio va sin IVA).
  showTax?: boolean
}

// Componente propio, no reutiliza ProductRow: el producto solo se elige en filas vacías y no se cambia después.
export function POSCartLine({
  index,
  register,
  control,
  watch,
  onRemove,
  onProductSelect,
  minSalePrice,
  availableStock,
  showTax = false,
}: POSCartLineProps) {
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch] = useDebounce(productSearch, 400)
  const productId = watch(`items.${index}.productId`)
  const isEmptyRow = !productId

  const { data: productData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-search-pos', debouncedProductSearch],
    queryFn: () => getProducts({ search: debouncedProductSearch, page: 1, limit: 20 }),
    staleTime: 2 * 60 * 1000,
    enabled: isEmptyRow && debouncedProductSearch.length >= 1,
  })

  const productOptions: ComboboxOption[] = (productData?.items ?? []).map((p) => ({
    id: p.id,
    label: `${p.code} — ${p.description}`,
    // La venta oficial no consulta stock físico.
    sublabel: showTax ? undefined : `Disponible: ${p.availableStock}`,
  }))

  const productCode = watch(`items.${index}.productCode`)
  const productDesc = watch(`items.${index}.productDesc`)
  const quantity = Number(watch(`items.${index}.quantity`) ?? 0)
  const unitPrice = Number(watch(`items.${index}.unitPrice`) ?? 0)
  const subtotal = quantity * unitPrice

  const isBelowFloor = minSalePrice !== undefined && unitPrice > 0 && unitPrice < minSalePrice
  const exceedsAvailable = availableStock !== undefined && quantity > availableStock

  return (
    <>
      <tr className={isBelowFloor ? 'bg-red-500/5' : undefined}>
        <td className="px-4 py-3 min-w-[220px]">
          {isEmptyRow ? (
            <Combobox
              value=""
              onChange={(id) => {
                const product = productData?.items.find((p) => p.id === id)
                if (product) onProductSelect(product)
              }}
              options={productOptions}
              isLoading={isLoadingProducts}
              placeholder="Selecciona un producto..."
              searchValue={productSearch}
              onSearchChange={setProductSearch}
            />
          ) : (
            <>
              <p className="text-sm text-content font-medium truncate">{productDesc}</p>
              <p className="text-xs text-content-faint font-mono">{productCode}</p>
            </>
          )}
        </td>

        <td className="px-4 py-3 w-24">
          <input
            type="number"
            min={1}
            step={1}
            {...register(`items.${index}.quantity`)}
            className="input-hard w-full px-2.5 py-1.5 text-sm text-center text-content transition-all border-ui-border-medium"
          />
        </td>

        <td className="px-4 py-3 w-32">
          <Controller
            control={control}
            name={`items.${index}.unitPrice`}
            render={({ field }) => (
              <ThousandsInput
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                className={cn(
                  'text-right bg-surface-raised',
                  isBelowFloor ? 'border-red-500' : undefined,
                )}
              />
            )}
          />
        </td>

        <td className="px-4 py-3 w-32 text-right">
          <span className="text-sm text-content-secondary font-medium">{formatCOP(subtotal)}</span>
        </td>

        {showTax && (
          <td className="px-4 py-3 w-28 text-right">
            <span className="text-sm text-content-muted">
              {formatCOP(computeOfficialLineTax(subtotal))}
            </span>
          </td>
        )}

        <td className="px-4 py-3 w-40">
          <span className="text-xs text-content-muted font-mono">
            {formatDateTimeBogota(watch(`items.${index}.addedAt`))}
          </span>
        </td>

        <td className="px-3 py-3 w-10 text-center">
          <button
            type="button"
            onClick={onRemove}
            aria-label="Quitar producto"
            className="p-1.5 rounded-lg text-content-faint hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </td>
      </tr>

      {(isBelowFloor || exceedsAvailable) && (
        <tr>
          <td className="px-4 pt-0 pb-2" colSpan={showTax ? 7 : 6}>
            <div className="flex flex-wrap gap-x-4">
              {isBelowFloor && (
                <HintText variant="warning">
                  Por debajo del precio mínimo ({formatCOP(minSalePrice!)})
                </HintText>
              )}
              {exceedsAvailable && (
                <HintText variant="warning">Supera el disponible ({availableStock})</HintText>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
