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
  getValues: UseFormGetValues<FormValues>
  // Costo promedio ya conocido al momento de crear la fila (ej. vía escaneo de código de barras),
  // para que el warning de desviación EAI y la celda de solo lectura SAJ no queden vacíos solo
  // porque la fila no se creó a través del combobox de esta misma fila (ver onChange más abajo).
  initialAvgCost?: number
  // Unidad de medida ya conocida al momento de crear la fila (ej. vía escaneo de código de barras) —
  // mismo motivo que initialAvgCost: la fila no siempre pasa por el combobox propio, que es donde
  // normalmente se resuelve el producto y se llenaría este dato.
  initialUnitOfMeasure?: 'unidad' | 'docena'
  // Stock disponible (totalStock - reservado) ya conocido al momento de crear la fila (ej. vía
  // escaneo de código de barras) — mismo patrón que initialAvgCost, usado en PV para el hint de
  // disponible y el warning de cantidad-supera-disponible bajo el input de cantidad.
  initialAvailableStock?: number
  // Registra/desregistra el <input> de cantidad de esta fila en el Map de refs que vive en
  // DocumentFormPage — necesario para el ciclo de foco escaneo→cantidad→escaneo (ver
  // BarcodeScanInput). Opcional porque ProductRow no depende de este flujo para funcionar.
  quantityInputRef?: (el: HTMLInputElement | null) => void
  // Devuelve el foco al input de escaneo cuando el operario confirma (Enter) la cantidad de
  // esta fila. Incondicional: cualquier Enter en cantidad vuelve al escáner, sin importar si
  // la fila se creó por escaneo o por el combobox manual.
  onQuantityConfirmed?: () => void
}

export function ProductRow({ index, docType, onRemove, register, setValue, watch, getValues, initialAvgCost, initialUnitOfMeasure, initialAvailableStock, quantityInputRef, onQuantityConfirmed }: ProductRowProps) {
  const [productSearch, setProductSearch] = useState('')
  const [debouncedProductSearch] = useDebounce(productSearch, 400)
  // Costo promedio del producto al momento de seleccionarlo — solo para comparar contra lo digitado
  const [selectedAvgCost, setSelectedAvgCost] = useState<number | null>(() => initialAvgCost ?? null)
  // Unidad de medida del producto seleccionado — puramente informativa, ver hint en la columna Cantidad
  // para docType === 'T'. Nunca participa en ningún cálculo de cantidad/costo/stock.
  const [selectedUnitOfMeasure, setSelectedUnitOfMeasure] = useState<'unidad' | 'docena' | null>(
    () => initialUnitOfMeasure ?? null,
  )
  // Stock disponible del producto al momento de seleccionarlo — solo preventas (PV), puede ser
  // negativo (ya sobre-reservado). Solo informativo: el backend rechaza con 409 si de verdad no
  // alcanza al confirmar, esto es feedback temprano no bloqueante.
  const [selectedAvailableStock, setSelectedAvailableStock] = useState<number | null>(
    () => initialAvailableStock ?? null,
  )
  // Stock por bodega del producto seleccionado — solo traslados (T), para derivar el disponible
  // en la bodega ORIGEN elegida (ver availableInSourceWarehouse). No se prellena vía
  // initial*Prop porque, a diferencia de avgCost/unitOfMeasure/availableStock, el escaneo de
  // código de barras no trae hoy este array completo por bodega.
  const [selectedStockByWarehouse, setSelectedStockByWarehouse] = useState<StockByWarehouse[] | null>(null)

  const productId   = watch(`items.${index}.productId`)
  const productCode = watch(`items.${index}.productCode`)
  const productDesc = watch(`items.${index}.productDesc`)
  const quantity    = watch(`items.${index}.quantity`) ?? 0
  const unitCost    = watch(`items.${index}.unitCost`) ?? 0
  const unitPrice   = watch(`items.${index}.unitPrice`) ?? 0

  const subtotal    = Number(quantity) * Number(unitCost)
  // Nota de talla por línea — solo aplica a traslados (T): permite registrar el mismo código
  // de producto repartido en varios bultos, cada uno con una talla distinta.
  const showObservaciones = docType === 'T'
  const showCost    = docType === 'CM' || docType === 'DVC' || docType === 'EAI'
  // SAJ y T nunca permiten digitar el costo: SAJ porque el backend siempre usa el avgCost vigente
  // del producto (SajEffectStrategy); T porque un traslado no tiene costo real, solo se muestra
  // el avgCost como referencia informativa para que el subtotal de la fila tenga sentido.
  const showCostReadonly = docType === 'SAJ' || docType === 'T'
  // Ni SAJ ni T llenan items.${index}.unitCost (no hay input ni autofill), así que el subtotal
  // basado en ese campo siempre daría 0 — se calcula aparte con el avgCost seleccionado.
  const readonlySubtotal = selectedAvgCost !== null ? Number(quantity) * selectedAvgCost : null
  const costOptional = docType === 'EAI'

  // Preventas (PV) — sin costo (es venta, no compra): el campo editable es el precio de venta,
  // prellenado con el salePrice vigente del producto pero ajustable (ej. descuento puntual).
  const showPrice = docType === 'PV'
  const priceSubtotal = Number(quantity) * Number(unitPrice)

  // Traslados (T) — bodega origen elegida en el formulario (campo "Bodega origen"). Se usa para
  // mostrar el disponible en esa bodega, no el del bulto específico (sourceBinId): el disponible
  // por bulto varía según cuál elijas, y el backend ya valida a nivel de bulto al confirmar
  // (assertSufficientBinStock, con su propio mensaje de error) — mostrar el total de bodega es
  // suficiente como feedback temprano no bloqueante aquí.
  const showTransferAvailability = docType === 'T'
  const sourceWarehouseId = watch('warehouseId')
  const availableInSourceWarehouse = showTransferAvailability && sourceWarehouseId
    ? (selectedStockByWarehouse?.find((s) => s.warehouseId === sourceWarehouseId)?.quantity ?? null)
    : null

  // PV reserva inventario lógicamente (selectedAvailableStock ya viene neto de reservas, puede
  // ser negativo); T no tiene concepto de "reservado" — availableInSourceWarehouse es el stock
  // crudo de la bodega origen. Son fuentes distintas que nunca deben mezclarse en una sola
  // fórmula: cada bloque de abajo calcula su propio warning/hint con su propia fuente, y el
  // backend ya rechaza con 409/mensaje claro si de verdad no alcanza al confirmar en cualquiera
  // de los dos casos — esto es solo feedback temprano no bloqueante.
  const showPvAvailableWarning =
    showPrice && selectedAvailableStock !== null && Number(quantity) > selectedAvailableStock
  const showTransferAvailableWarning =
    showTransferAvailability && availableInSourceWarehouse !== null && Number(quantity) > availableInSourceWarehouse
  const showAvailableStockWarning = showPvAvailableWarning || showTransferAvailableWarning

  const costDeviation = selectedAvgCost && selectedAvgCost > 0 && Number(unitCost) > 0
    ? Math.abs(Number(unitCost) - selectedAvgCost) / selectedAvgCost
    : 0
  const showCostWarning = costOptional && costDeviation > COST_DEVIATION_THRESHOLD

  // Hints/warnings secundarios de la fila — viven en una <tr> aparte (ver return) para que ningún
  // texto extra empuje verticalmente los inputs de la fila principal de controles, que deben quedar
  // siempre alineados entre columnas sin importar cuántos hints apliquen para esta fila en particular.
  const showUnitOfMeasureHint = docType === 'T' && selectedUnitOfMeasure === 'docena'
  const showPvAvailableHint =
    showPrice && selectedAvailableStock !== null && !showPvAvailableWarning
  const showTransferAvailableHint =
    showTransferAvailability && availableInSourceWarehouse !== null && !showTransferAvailableWarning
  const showAvailableStockHint = showPvAvailableHint || showTransferAvailableHint
  const hasSecondaryRow =
    showUnitOfMeasureHint || showAvailableStockHint || showAvailableStockWarning || showCostWarning

  // Solo para elegir QUÉ número mostrar en los hints de disponibilidad de esta fila — PV y T son
  // mutuamente excluyentes por docType (showPrice/showTransferAvailability nunca son true a la
  // vez), así que no hay ambigüedad; el cálculo de cada warning/hint sigue viviendo por separado
  // arriba, con su propia fuente (ver comentario en showPvAvailableWarning).
  const displayAvailableStock = showPrice ? selectedAvailableStock : availableInSourceWarehouse

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
    // PV muestra el disponible neto de reservas por producto (para elegir con criterio antes de
    // reservar); T muestra el disponible en la bodega origen ya elegida (mismo criterio que
    // availableInSourceWarehouse, pero leído directo de p.stockByWarehouse porque acá se itera
    // sobre los resultados de búsqueda, no sobre el producto ya seleccionado); el resto de tipos
    // sigue mostrando el costo promedio.
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
      // Valor numérico crudo (sin formatear) — se pega directo en el input de costo del EAI de destino.
      await navigator.clipboard.writeText(String(selectedAvgCost))
      toast.success('Costo copiado')
    } catch {
      toast.error('No se pudo copiar el costo')
    }
  }

  return (
    <>
      <tr className="group">
        {/* Product combobox */}
        <td className="px-3 py-2 min-w-[260px]">
          <Combobox
            value={productId ?? ''}
            onChange={(id) => {
              const product = productData?.items.find((p: Product) => p.id === id)

              // Excluye el índice propio: una fila que ya tiene este productId (ej. reabrir su
              // combobox sin cambiar nada) no debe detectarse a sí misma como duplicado.
              const currentItems = getValues('items')
              const existingIndex = currentItems.findIndex((item, i) => item.productId === id && i !== index)

              if (existingIndex >= 0) {
                // Mismo patrón que BarcodeScanInput: el producto ya está en otra fila, se fusiona
                // la cantidad ahí en vez de dejar dos filas con el mismo productId (causa del bug
                // de avgCost — ver plans/004-avgcost-stale-read-duplicate-product-lines.md).
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
            placeholder="Selecciona un producto..."
            searchValue={productSearch}
            onSearchChange={setProductSearch}
          />
          <input type="hidden" {...register(`items.${index}.productId`)} />
          <input type="hidden" {...register(`items.${index}.productCode`)} />
          <input type="hidden" {...register(`items.${index}.productDesc`)} />
        </td>

        {/* Quantity */}
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

        {/* Observaciones (talla) — solo traslados (T) */}
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

        {/* Unit cost */}
        {showCost && (
          <td className="px-3 py-2 w-36">
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder={costOptional ? 'Costo promedio' : undefined}
              {...register(`items.${index}.unitCost`)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all border-ui-border-medium"
            />
          </td>
        )}

        {/* Unit cost — read-only for SAJ and T: backend always uses the product's current avgCost */}
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

        {/* Unit price — solo preventas (PV): editable, prellenado con salePrice, sin costo */}
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

      {/* Fila secundaria — hints/warnings de texto secundario, separados de la fila de controles
          para que ningún <p> extra empuje verticalmente un input específico y desalinee la fila
          (ver comentario en showUnitOfMeasureHint/hasSecondaryRow más arriba). Mismos anchos de
          columna que la fila principal, con menos padding vertical (pt-0 pb-2) para sentirse
          pegada a ella en vez de una fila completa. Solo se renderiza si hay algo que mostrar. */}
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
          {(showCost || showCostReadonly || showPrice) && (
            <td className="px-3 pt-0 pb-2 w-36">
              {showCostWarning && (
                <HintText variant="warning">
                  Se aleja del costo prom. ({formatCOP(selectedAvgCost!)})
                </HintText>
              )}
            </td>
          )}
          <td className="px-3 pt-0 pb-2 w-32" />
          <td className="px-3 pt-0 pb-2 w-12" />
        </tr>
      )}
    </>
  )
}
