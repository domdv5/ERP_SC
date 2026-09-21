import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { Trash2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import type {
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  UseFormGetValues,
} from 'react-hook-form'
import { Combobox, HintText } from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { getProducts } from '@/services/products.service'
import { formatCOP } from '@/lib/format'
import type { Product, StockByWarehouse } from '@/types/product.types'
import type { DocumentType } from '@/types/document.types'
import type { FormValues } from '@/pages/documents/document-form.schema'

interface ProductRowProps {
  index: number
  docType: DocumentType
  onRemove: () => void
  register: UseFormRegister<FormValues>
  setValue: UseFormSetValue<FormValues>
  watch: UseFormWatch<FormValues>
  getValues: UseFormGetValues<FormValues>
  // Ya conocido al crear la fila (p. ej. por escaneo), para no dejar vacíos el aviso de desviación y la celda readonly.
  initialAvgCost?: number
  // Ya conocido al crear la fila (p. ej. por escaneo); no siempre pasa por su propio buscador.
  initialUnitOfMeasure?: 'unidad' | 'docena'
  // Ya conocido al crear la fila (p. ej. por escaneo); alimenta el aviso de "cantidad mayor al disponible".
  initialAvailableStock?: number
  // Referencia al input de cantidad para el ciclo de foco escanear → cantidad → escanear; opcional, la fila funciona igual sin esto.
  quantityInputRef?: (el: HTMLInputElement | null) => void
  // Devuelve el foco al escáner al confirmar cantidad con Enter, se haya creado la fila por escaneo o a mano.
  onQuantityConfirmed?: () => void
  // Marcas del proveedor elegido (solo compras/devoluciones); sin valor cuando el tipo no usa este filtro.
  supplierBrandIds?: string[]
}

export function ProductRow({
  index,
  docType,
  onRemove,
  register,
  setValue,
  watch,
  getValues,
  initialAvgCost,
  initialUnitOfMeasure,
  initialAvailableStock,
  quantityInputRef,
  onQuantityConfirmed,
  supplierBrandIds,
}: ProductRowProps) {
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch] = useDebounce(productSearch, 400)
  // Costo promedio del producto al momento de elegirlo, solo para comparar contra lo digitado.
  const [selectedAvgCost, setSelectedAvgCost] = useState<number | null>(
    () => initialAvgCost ?? null,
  )
  // Solo informativa (traslados); nunca entra en ningún cálculo de cantidad, costo o stock.
  const [selectedUnitOfMeasure, setSelectedUnitOfMeasure] = useState<'unidad' | 'docena' | null>(
    () => initialUnitOfMeasure ?? null,
  )
  // Puede ser negativo si ya está sobre-reservado; es solo aviso temprano, el backend valida de verdad al confirmar.
  const [selectedAvailableStock, setSelectedAvailableStock] = useState<number | null>(
    () => initialAvailableStock ?? null,
  )
  // No se prellena desde props iniciales: el escaneo no trae este detalle por bodega.
  const [selectedStockByWarehouse, setSelectedStockByWarehouse] = useState<
    StockByWarehouse[] | null
  >(null)

  const productId = watch(`items.${index}.productId`)
  const productCode = watch(`items.${index}.productCode`)
  const productDesc = watch(`items.${index}.productDesc`)
  const quantity = watch(`items.${index}.quantity`) ?? 0
  const unitCost = watch(`items.${index}.unitCost`) ?? 0
  const unitPrice = watch(`items.${index}.unitPrice`) ?? 0

  const subtotal = Number(quantity) * Number(unitCost)
  // Solo en traslados: mismo producto repartido en varios bultos, cada uno con talla distinta.
  const showObservaciones = docType === 'T'
  // Sin proveedor elegido el buscador queda deshabilitado, no se muestra sin filtrar.
  const needsSupplier = docType === 'CM' || docType === 'DVC'
  const noSupplierYet = needsSupplier && !watch('thirdPartyId')
  const showCost = docType === 'CM' || docType === 'DVC' || docType === 'EAI'
  // SAJ/T nunca dejan digitar costo: SAJ usa siempre el costo promedio, T solo lo muestra de referencia.
  const showCostReadonly = docType === 'SAJ' || docType === 'T'
  // SAJ/T no llenan el costo de línea, así que el subtotal se calcula aparte con el costo promedio.
  const readonlySubtotal = selectedAvgCost !== null ? Number(quantity) * selectedAvgCost : null

  // PV/REM/DVV no llevan costo (son venta): el campo editable es el precio de venta.
  const showPrice = docType === 'PV' || docType === 'REM' || docType === 'DVV'
  const priceSubtotal = Number(quantity) * Number(unitPrice)
  // Solo aplica a PV/REM (sacan stock); en DVV el stock entra, así que el dato confundiría.
  const showSaleAvailability = showPrice && docType !== 'DVV'

  // Disponible de la bodega origen, no del bulto concreto (el backend valida a nivel de bulto al confirmar).
  const showTransferAvailability = docType === 'T'
  const sourceWarehouseId = watch('warehouseId')
  const availableInSourceWarehouse =
    showTransferAvailability && sourceWarehouseId
      ? (selectedStockByWarehouse?.find((s) => s.warehouseId === sourceWarehouseId)?.quantity ??
        null)
      : null

  // PV/REM: disponible ya neteado de reservas, puede ser negativo. Traslados: stock crudo de la bodega origen. Fuentes distintas, no mezclar.
  const showPvAvailableWarning =
    showSaleAvailability &&
    selectedAvailableStock !== null &&
    Number(quantity) > selectedAvailableStock
  const showTransferAvailableWarning =
    showTransferAvailability &&
    availableInSourceWarehouse !== null &&
    Number(quantity) > availableInSourceWarehouse
  const showAvailableStockWarning = showPvAvailableWarning || showTransferAvailableWarning

  // Avisos secundarios en fila aparte para no empujar los inputs de la fila principal fuera de columna.
  const showUnitOfMeasureHint = docType === 'T' && selectedUnitOfMeasure === 'docena'
  const showPvAvailableHint =
    showSaleAvailability && selectedAvailableStock !== null && !showPvAvailableWarning
  const showTransferAvailableHint =
    showTransferAvailability && availableInSourceWarehouse !== null && !showTransferAvailableWarning
  const showAvailableStockHint = showPvAvailableHint || showTransferAvailableHint
  const hasSecondaryRow =
    showUnitOfMeasureHint || showAvailableStockHint || showAvailableStockWarning

  // Elige qué número mostrar en el aviso de disponibilidad; venta y traslado nunca se dan a la vez.
  const displayAvailableStock = showPrice ? selectedAvailableStock : availableInSourceWarehouse

  const hasSearch = debouncedProductSearch.length >= 1
  const thirdPartyId = watch('thirdPartyId')

  const { data: productData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-search', debouncedProductSearch, thirdPartyId],
    queryFn: () =>
      getProducts({
        search: debouncedProductSearch,
        page: 1,
        limit: 30,
        supplierId: needsSupplier ? thirdPartyId : undefined,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: hasSearch && !noSupplierYet,
  })

  const productOptions: ComboboxOption[] = (productData?.items ?? []).map((p: Product) => ({
    id: p.id,
    label: `${p.code} — ${p.description}`,
    // PV/REM: disponible ya neteado; traslados: disponible en la bodega origen; resto: costo promedio.
    sublabel: showPrice
      ? `Disponible: ${p.availableStock}`
      : showTransferAvailability && sourceWarehouseId
        ? `Disponible: ${p.stockByWarehouse.find((s) => s.warehouseId === sourceWarehouseId)?.quantity ?? 0}`
        : `Costo prom: ${formatCOP(Number(p.avgCost))}`,
  }))

  const displayOptions: ComboboxOption[] =
    productId && !hasSearch
      ? [{ id: productId, label: `${productCode} — ${productDesc}` }]
      : productOptions

  const handleCopyAvgCost = async () => {
    if (selectedAvgCost === null) return
    try {
      // Valor numérico sin formato: se pega directo en el campo de costo de la entrada por ajuste de destino.
      await navigator.clipboard.writeText(String(selectedAvgCost))
      toast.success('Costo copiado')
    } catch {
      toast.error('No se pudo copiar el costo')
    }
  }

  return (
    <>
      <tr className="group">
        {/* Buscador de producto */}
        <td className="px-3 py-2 min-w-[260px]">
          <Combobox
            value={productId ?? ''}
            onChange={(id) => {
              const product = productData?.items.find((p: Product) => p.id === id)

              // Chequeo extra por si llegó a las opciones un producto de marca equivocada (p. ej. caché vieja).
              if (
                needsSupplier &&
                supplierBrandIds !== undefined &&
                product &&
                !supplierBrandIds.includes(product.brandId)
              ) {
                toast.error(`${product.code} no pertenece a las marcas del proveedor seleccionado`)
                return
              }

              // Se excluye la fila actual para no detectarse a sí misma como duplicado.
              const currentItems = getValues('items')
              const existingIndex = currentItems.findIndex(
                (item, i) => item.productId === id && i !== index,
              )

              if (existingIndex >= 0) {
                // Se suma la cantidad en la fila existente en vez de duplicar (dejaba un bug en el costo promedio).
                const currentRowQty = Number(currentItems[index].quantity) || 0
                const existingQty = Number(currentItems[existingIndex].quantity) || 0
                setValue(`items.${existingIndex}.quantity`, existingQty + currentRowQty)
                onRemove()
                toast.success(`${product?.code} ya estaba en la lista — cantidad sumada`)
                return
              }

              setValue(`items.${index}.productId`, id)
              setValue(`items.${index}.productCode`, product?.code ?? '')
              setValue(`items.${index}.productDesc`, product?.description ?? '')
              setSelectedAvgCost(product?.avgCost ? Number(product.avgCost) : null)
              setSelectedUnitOfMeasure(product?.unitOfMeasure ?? null)
              setSelectedAvailableStock(product?.availableStock ?? null)
              setSelectedStockByWarehouse(product?.stockByWarehouse ?? null)
              if (showCost && product?.avgCost) {
                setValue(`items.${index}.unitCost`, Number(product.avgCost))
              }
              if (showPrice && product?.salePrice) {
                setValue(`items.${index}.unitPrice`, Number(product.salePrice))
              }
            }}
            options={displayOptions}
            isLoading={isLoadingProducts}
            disabled={noSupplierYet}
            placeholder={
              noSupplierYet ? 'Selecciona un proveedor primero' : 'Selecciona un producto...'
            }
            searchValue={productSearch}
            onSearchChange={setProductSearch}
          />
          <input type="hidden" {...register(`items.${index}.productId`)} />
          <input type="hidden" {...register(`items.${index}.productCode`)} />
          <input type="hidden" {...register(`items.${index}.productDesc`)} />
        </td>

        {/* Cantidad */}
        <td className="px-3 py-2 w-28">
          {(() => {
            const { ref: quantityRegisterRef, ...quantityRegisterRest } = register(
              `items.${index}.quantity`,
            )
            return (
              <input
                type="number"
                min={1}
                step={1}
                {...quantityRegisterRest}
                ref={(el) => {
                  quantityRegisterRef(el)
                  quantityInputRef?.(el)
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  onQuantityConfirmed?.()
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all border-ui-border-medium"
              />
            )
          })()}
        </td>

        {/* Observaciones (talla) — solo en traslados */}
        {showObservaciones && (
          <td className="px-3 py-2 w-40">
            <input
              type="text"
              maxLength={500}
              placeholder="Talla / nota..."
              {...register(`items.${index}.observaciones`)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all border-ui-border-medium"
            />
          </td>
        )}

        {/* Costo unitario */}
        {showCost && (
          <td className="px-3 py-2 w-36">
            <input
              type="number"
              min={0}
              step={0.01}
              {...register(`items.${index}.unitCost`)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all border-ui-border-medium"
            />
          </td>
        )}

        {/* Costo unitario — de solo lectura en salidas por ajuste y traslados: el backend siempre usa el costo promedio del producto */}
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

        {/* Precio unitario — solo preventas y remisiones: editable, prellenado con el precio de venta, sin costo */}
        {showPrice && (
          <td className="px-3 py-2 w-36">
            <input
              type="number"
              min={0}
              step={0.01}
              {...register(`items.${index}.unitPrice`)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all border-ui-border-medium"
            />
          </td>
        )}

        {/* Subtotal */}
        <td className="px-3 py-2 w-32 text-right">
          <span className="text-sm text-content-secondary font-medium">
            {showCost
              ? formatCOP(subtotal)
              : showCostReadonly && readonlySubtotal !== null
                ? formatCOP(readonlySubtotal)
                : showPrice
                  ? formatCOP(priceSubtotal)
                  : '—'}
          </span>
        </td>

        {/* Quitar */}
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

      {/* Fila secundaria — avisos de texto, separados de la fila de controles para que ningún
          texto extra empuje hacia abajo un input y desalinee la fila. Usa los mismos anchos de
          columna que la fila principal, con menos espacio arriba y abajo para sentirse pegada a
          ella. Solo se muestra si hay algo que mostrar. */}
      {hasSecondaryRow && (
        <tr>
          <td className="px-3 pt-0 pb-2 min-w-[260px]">
            {showAvailableStockHint && (
              <HintText variant={displayAvailableStock! < 0 ? 'warning' : 'positive'}>
                Disponible: {displayAvailableStock}
              </HintText>
            )}
            {showAvailableStockWarning && (
              <HintText variant="warning">Supera el disponible ({displayAvailableStock})</HintText>
            )}
          </td>
          <td className="px-3 pt-0 pb-2 w-28">
            {showUnitOfMeasureHint && <HintText variant="neutral">Se maneja por docena</HintText>}
          </td>
          {showObservaciones && <td className="px-3 pt-0 pb-2 w-40" />}
          {(showCost || showCostReadonly || showPrice) && <td className="px-3 pt-0 pb-2 w-36" />}
          <td className="px-3 pt-0 pb-2 w-32" />
          <td className="px-3 pt-0 pb-2 w-12" />
        </tr>
      )}
    </>
  )
}
