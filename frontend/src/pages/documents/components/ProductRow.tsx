import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { Trash2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import type { UseFormRegister, UseFormSetValue, UseFormWatch, UseFormGetValues } from 'react-hook-form'
import { Combobox, HintText } from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { getProducts } from '@/services/products.service'
import type { Product, StockByWarehouse } from '@/types/product.types'
import type { DocumentType } from '@/types/document.types'
import type { FormValues } from '@/pages/documents/document-form.schema'

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

interface ProductRowProps {
  index: number
  docType: DocumentType
  onRemove: () => void
  register: UseFormRegister<FormValues>
  setValue: UseFormSetValue<FormValues>
  watch: UseFormWatch<FormValues>
  getValues: UseFormGetValues<FormValues>
  // Costo promedio ya conocido al crear la fila (p. ej. por escaneo), para que el aviso de
  // desviación en entradas por ajuste y la celda de solo lectura en salidas por ajuste no
  // queden vacíos solo porque la fila no se creó desde el buscador de esta misma fila.
  initialAvgCost?: number
  // Unidad de medida ya conocida al crear la fila (p. ej. por escaneo). Mismo motivo que el
  // costo promedio inicial: la fila no siempre pasa por su propio buscador, que es donde
  // normalmente se resolvería el producto y se llenaría este dato.
  initialUnitOfMeasure?: 'unidad' | 'docena'
  // Stock disponible (total menos lo reservado) ya conocido al crear la fila (p. ej. por
  // escaneo). Mismo patrón que el costo promedio inicial; en preventas y remisiones alimenta
  // el dato de disponible y el aviso de "cantidad mayor al disponible" bajo el input de cantidad.
  initialAvailableStock?: number
  // Registra o quita el input de cantidad de esta fila en la lista de referencias que mantiene
  // el formulario, necesaria para el ciclo de foco escanear → cantidad → escanear. Es opcional
  // porque la fila funciona igual sin este flujo.
  quantityInputRef?: (el: HTMLInputElement | null) => void
  // Devuelve el foco al input de escaneo cuando el operario confirma la cantidad de esta fila
  // con Enter. Siempre: cualquier Enter en cantidad vuelve al escáner, se haya creado la fila
  // por escaneo o a mano.
  onQuantityConfirmed?: () => void
  // Marcas del proveedor elegido en el documento (solo compras y devoluciones): el buscador de
  // producto solo trae productos de esas marcas. Viene sin valor cuando el tipo de documento no
  // usa este filtro; la fila decide internamente si lo aplica.
  supplierBrandIds?: string[]
}

export function ProductRow({ index, docType, onRemove, register, setValue, watch, getValues, initialAvgCost, initialUnitOfMeasure, initialAvailableStock, quantityInputRef, onQuantityConfirmed, supplierBrandIds }: ProductRowProps) {
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch] = useDebounce(productSearch, 400)
  // Costo promedio del producto al momento de elegirlo, solo para comparar contra lo digitado.
  const [selectedAvgCost, setSelectedAvgCost] = useState<number | null>(() => initialAvgCost ?? null)
  // Unidad de medida del producto elegido, solo informativa (se muestra como dato junto a la
  // cantidad en traslados). Nunca entra en ningún cálculo de cantidad, costo o stock.
  const [selectedUnitOfMeasure, setSelectedUnitOfMeasure] = useState<'unidad' | 'docena' | null>(
    () => initialUnitOfMeasure ?? null,
  )
  // Stock disponible del producto al momento de elegirlo (preventas y remisiones); puede ser
  // negativo si ya está sobre-reservado. Solo informativo: el backend rechaza al confirmar si
  // de verdad no alcanza; esto es solo un aviso temprano.
  const [selectedAvailableStock, setSelectedAvailableStock] = useState<number | null>(
    () => initialAvailableStock ?? null,
  )
  // Stock por bodega del producto elegido (solo traslados), para calcular el disponible en la
  // bodega origen. No se prellena desde las props iniciales porque, a diferencia del costo
  // promedio o el disponible, el escaneo hoy no trae este detalle por bodega.
  const [selectedStockByWarehouse, setSelectedStockByWarehouse] = useState<StockByWarehouse[] | null>(null)

  const productId   = watch(`items.${index}.productId`)
  const productCode = watch(`items.${index}.productCode`)
  const productDesc = watch(`items.${index}.productDesc`)
  const quantity    = watch(`items.${index}.quantity`) ?? 0
  const unitCost    = watch(`items.${index}.unitCost`) ?? 0
  const unitPrice   = watch(`items.${index}.unitPrice`) ?? 0

  const subtotal    = Number(quantity) * Number(unitCost)
  // Nota de talla por línea: solo en traslados. Permite registrar un mismo producto repartido
  // en varios bultos, cada uno con una talla distinta.
  const showObservaciones = docType === 'T'
  // En compras y devoluciones el buscador de producto se limita a las marcas del proveedor
  // elegido. Mientras no haya proveedor, el buscador queda deshabilitado en vez de mostrarse
  // sin filtrar.
  const needsSupplier = docType === 'CM' || docType === 'DVC'
  const noSupplierYet = needsSupplier && !watch('thirdPartyId')
  const showCost    = docType === 'CM' || docType === 'DVC' || docType === 'EAI'
  // Las salidas por ajuste y los traslados nunca dejan digitar el costo: en la salida por
  // ajuste el backend siempre usa el costo promedio del producto; el traslado no tiene costo
  // real, solo muestra el promedio como referencia para que el subtotal de la fila tenga sentido.
  const showCostReadonly = docType === 'SAJ' || docType === 'T'
  // Ni la salida por ajuste ni el traslado llenan el costo de la línea (no hay input ni
  // autocompletado), así que el subtotal basado en ese campo daría siempre 0: se calcula aparte
  // con el costo promedio del producto elegido.
  const readonlySubtotal = selectedAvgCost !== null ? Number(quantity) * selectedAvgCost : null

  // Preventas y remisiones no llevan costo (son venta, no compra): el campo editable es el
  // precio de venta, prellenado con el del producto pero ajustable (p. ej. un descuento puntual).
  const showPrice = docType === 'PV' || docType === 'REM'
  const priceSubtotal = Number(quantity) * Number(unitPrice)

  // Traslados: bodega origen elegida en el formulario. Se usa para mostrar el disponible en esa
  // bodega, no el del bulto concreto: el disponible por bulto cambia según cuál elijas, y el
  // backend ya valida a nivel de bulto al confirmar. Mostrar el total de la bodega alcanza como
  // aviso temprano.
  const showTransferAvailability = docType === 'T'
  const sourceWarehouseId = watch('warehouseId')
  const availableInSourceWarehouse = showTransferAvailability && sourceWarehouseId
    ? (selectedStockByWarehouse?.find((s) => s.warehouseId === sourceWarehouseId)?.quantity ?? null)
    : null

  // En preventas y remisiones el disponible ya viene con las reservas descontadas y puede ser
  // negativo. En traslados no existe "reservado": el disponible es el stock crudo de la bodega
  // origen. Son fuentes distintas y no deben mezclarse: cada bloque de abajo calcula su propio
  // aviso con su propia fuente. El backend igual rechaza al confirmar si de verdad no alcanza;
  // esto es solo un aviso temprano.
  const showPvAvailableWarning =
    showPrice && selectedAvailableStock !== null && Number(quantity) > selectedAvailableStock
  const showTransferAvailableWarning =
    showTransferAvailability && availableInSourceWarehouse !== null && Number(quantity) > availableInSourceWarehouse
  const showAvailableStockWarning = showPvAvailableWarning || showTransferAvailableWarning

  // Los avisos secundarios de la fila van en una fila aparte para que ningún texto extra
  // empuje hacia abajo los inputs de la fila principal, que deben quedar siempre alineados
  // entre columnas sin importar cuántos avisos apliquen.
  const showUnitOfMeasureHint = docType === 'T' && selectedUnitOfMeasure === 'docena'
  const showPvAvailableHint =
    showPrice && selectedAvailableStock !== null && !showPvAvailableWarning
  const showTransferAvailableHint =
    showTransferAvailability && availableInSourceWarehouse !== null && !showTransferAvailableWarning
  const showAvailableStockHint = showPvAvailableHint || showTransferAvailableHint
  const hasSecondaryRow =
    showUnitOfMeasureHint || showAvailableStockHint || showAvailableStockWarning

  // Solo sirve para elegir QUÉ número mostrar en los avisos de disponibilidad de la fila. Los
  // casos de venta y de traslado nunca se dan a la vez, así que no hay ambigüedad; cada aviso
  // se calcula por separado arriba, con su propia fuente.
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
    // Preventas y remisiones muestran el disponible del producto ya con las reservas
    // descontadas; los traslados, el disponible en la bodega origen elegida; el resto de tipos
    // muestra el costo promedio.
    sublabel: showPrice
      ? `Disponible: ${p.availableStock}`
      : showTransferAvailability && sourceWarehouseId
        ? `Disponible: ${p.stockByWarehouse.find((s) => s.warehouseId === sourceWarehouseId)?.quantity ?? 0}`
        : `Costo prom: ${formatCOP(Number(p.avgCost))}`,
  }))

  const displayOptions: ComboboxOption[] = productId && !hasSearch
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

              // Chequeo extra: el backend ya filtra por proveedor, pero esto evita agregar un
              // producto de una marca equivocada si igual llegó a las opciones (p. ej. por caché
              // vieja). Solo aplica en compras y devoluciones: el padre puede pasar la lista de
              // marcas sin filtrar por tipo, y decidir si usarla es responsabilidad de esta fila.
              if (needsSupplier && supplierBrandIds !== undefined && product && !supplierBrandIds.includes(product.brandId)) {
                toast.error(`${product.code} no pertenece a las marcas del proveedor seleccionado`)
                return
              }

              // Se excluye la fila actual: si ya tiene este producto (p. ej. al reabrir su
              // buscador sin cambiar nada), no debe detectarse a sí misma como duplicado.
              const currentItems = getValues('items')
              const existingIndex = currentItems.findIndex((item, i) => item.productId === id && i !== index)

              if (existingIndex >= 0) {
                // El producto ya está en otra fila: se suma la cantidad ahí en vez de dejar dos
                // filas con el mismo producto (eso causaba un bug en el costo promedio).
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
            placeholder={noSupplierYet ? 'Selecciona un proveedor primero' : 'Selecciona un producto...'}
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
            const { ref: quantityRegisterRef, ...quantityRegisterRest } = register(`items.${index}.quantity`)
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
            {showUnitOfMeasureHint && (
              <HintText variant="neutral">Se maneja por docena</HintText>
            )}
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
