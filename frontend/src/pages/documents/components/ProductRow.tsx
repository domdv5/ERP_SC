import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { Trash2 } from 'lucide-react'
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form'
import { Combobox } from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { getProducts } from '@/services/products.service'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/product.types'
import type { DocumentType } from '@/types/document.types'
import type { FormValues } from '../document-form.schema'

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

interface ProductRowProps {
  index: number
  docType: DocumentType
  onRemove: () => void
  register: UseFormRegister<FormValues>
  setValue: UseFormSetValue<FormValues>
  watch: UseFormWatch<FormValues>
  errors: FieldErrors<FormValues>
}

export function ProductRow({ index, docType, onRemove, register, setValue, watch, errors }: ProductRowProps) {
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch] = useDebounce(productSearch, 400)

  const productId   = watch(`items.${index}.productId`)
  const productCode = watch(`items.${index}.productCode`)
  const productDesc = watch(`items.${index}.productDesc`)
  const quantity    = watch(`items.${index}.quantity`) ?? 0
  const unitCost    = watch(`items.${index}.unitCost`) ?? 0

  const subtotal    = Number(quantity) * Number(unitCost)
  const showCost    = docType === 'CM' || docType === 'DVC' || docType === 'EAI'
  const costOptional = docType === 'EAI'

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
        </td>
      )}

      {/* Subtotal */}
      <td className="px-3 py-2 w-32 text-right">
        <span className="text-sm text-content-secondary font-medium">
          {showCost ? formatCOP(subtotal) : '—'}
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
