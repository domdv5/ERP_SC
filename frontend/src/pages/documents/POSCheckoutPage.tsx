import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { useDebounce } from 'use-debounce'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, ShoppingBag, User, UserCog, Wallet, ArrowRightLeft } from 'lucide-react'

import {
  getDocument,
  createDocument,
  updateDocument,
  confirmDocument,
  convertDocument,
} from '@/services/documents.service'
import { getThirdParties } from '@/services/third-parties.service'
import { getProducts, getProductByCode } from '@/services/products.service'
import { Combobox } from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { cn } from '@/lib/utils'
import { DOC_TYPE_ACCENT } from './document.constants'
import type { FormValues } from './document-form.schema'
import { BarcodeScanInput } from './components/BarcodeScanInput'
import { POSCartLine } from './components/POSCartLine'
import { POSStockShortfallDialog } from './components/POSStockShortfallDialog'
import {
  hasPendingItems,
  findActivePendingPreventa,
  findPriceFloorViolations,
  parseStockShortfallError,
  type StockShortfall,
} from './pos-checkout.utils'

import type { Document, DocumentSourceRef, PaymentMethod, UpdateDocumentPayload } from '@/types/document.types'
import type { ThirdParty } from '@/types/third-party.types'

// ─── constants ───────────────────────────────────────────────────────────────

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)

const docNumber = (type: string, number: number) => `${type}-${String(number).padStart(6, '0')}`

const TODAY = new Date().toISOString().slice(0, 10)

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
]

const accent = DOC_TYPE_ACCENT.POS

function extractErrorMessage(err: unknown): string | undefined {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  return typeof message === 'string' ? message : undefined
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function POSCheckoutPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const fromPVId = searchParams.get('fromPV') || undefined

  // Carrito — reusa el mismo FormValues/useFieldArray que DocumentFormPage porque
  // BarcodeScanInput (reutilizado tal cual, ver componente) exige exactamente ese tipo en sus
  // props append/getValues/setValue. El resto de FormValues (type/warehouseId/etc.) queda sin
  // usar — el payload real de POS se arma aparte, a mano, con los estados propios de esta página
  // (cliente/vendedor/forma de pago).
  const { control, register, watch, setValue, getValues } = useForm<FormValues>({
    defaultValues: { type: 'PV', date: TODAY, items: [] },
  })
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })
  const cartItems = watch('items')

  // ── cliente ────────────────────────────────────────────────────────────────
  const [thirdPartyId, setThirdPartyId] = useState('')
  const [tpSelectedName, setTpSelectedName] = useState('')
  const [tpSearch, setTpSearch] = useState('')
  const [debouncedTpSearch] = useDebounce(tpSearch, 400)
  const hasTpSearch = debouncedTpSearch.length >= 1

  const { data: tpData, isLoading: isLoadingTp } = useQuery({
    queryKey: ['third-parties-search-pos-customer', debouncedTpSearch],
    queryFn: () => getThirdParties({ search: debouncedTpSearch || undefined, page: 1, limit: 30, isCustomer: true }),
    staleTime: 2 * 60 * 1000,
    enabled: hasTpSearch,
  })

  const tpOptions: ComboboxOption[] = (tpData?.items ?? []).map((tp: ThirdParty) => ({ id: tp.id, label: tp.name }))
  const tpDisplayOptions: ComboboxOption[] = thirdPartyId && !debouncedTpSearch
    ? [{ id: thirdPartyId, label: tpSelectedName }, ...tpOptions.filter((o) => o.id !== thirdPartyId)]
    : tpOptions

  // ── vendedor ───────────────────────────────────────────────────────────────
  const [sellerId, setSellerId] = useState('')
  const [sellerSelectedName, setSellerSelectedName] = useState('')
  const [sellerSearch, setSellerSearch] = useState('')
  const [debouncedSellerSearch] = useDebounce(sellerSearch, 400)
  const hasSellerSearch = debouncedSellerSearch.length >= 1

  const { data: sellerData, isLoading: isLoadingSeller } = useQuery({
    queryKey: ['third-parties-search-pos-seller', debouncedSellerSearch],
    queryFn: () => getThirdParties({ search: debouncedSellerSearch || undefined, page: 1, limit: 30, isSeller: true }),
    staleTime: 2 * 60 * 1000,
    enabled: hasSellerSearch,
  })

  const sellerOptions: ComboboxOption[] = (sellerData?.items ?? []).map((tp: ThirdParty) => ({ id: tp.id, label: tp.name }))
  const sellerDisplayOptions: ComboboxOption[] = sellerId && !debouncedSellerSearch
    ? [{ id: sellerId, label: sellerSelectedName }, ...sellerOptions.filter((o) => o.id !== sellerId)]
    : sellerOptions

  // ── forma de pago ─────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('')

  // ── borrador en curso (create→confirm, o conversión ya aplicada) ─────────
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftNumber, setDraftNumber] = useState<number | null>(null)
  const [sourceDocument, setSourceDocument] = useState<DocumentSourceRef | null>(null)

  // ── preventa activa pendiente de convertir ────────────────────────────────
  const [pendingPreventa, setPendingPreventa] = useState<Document | null>(null)
  const [checkingPreventa, setCheckingPreventa] = useState(false)

  // Detección al elegir cliente manualmente — vive en el propio onChange del combobox (no en un
  // useEffect sobre thirdPartyId) para no re-dispararse cuando el hydrate de una conversión ya
  // aplicada fija thirdPartyId por código: esa misma PV convertida sigue teniendo pendiente > 0
  // hasta que el POS derivado se confirme (ver comentario en convertDocument, documents.service.ts),
  // así que un efecto reactivo volvería a mostrar el aviso en bucle justo después de aceptarlo.
  async function handleCustomerSelected(id: string, label: string) {
    setThirdPartyId(id)
    setTpSelectedName(label)
    setPendingPreventa(null)
    setCheckingPreventa(true)
    try {
      const pv = await findActivePendingPreventa(id)
      setPendingPreventa(pv)
    } catch {
      // Aviso no bloqueante — si la detección falla, el operario simplemente no ve el banner y
      // sigue con una venta normal; no vale la pena un toast de error para esto.
    } finally {
      setCheckingPreventa(false)
    }
  }

  // Entrada desde "Convertir a venta" (DocumentDetailPage) — precarga la preventa por id y
  // dispara el mismo aviso/flujo de conversión, sin que el operario tenga que rebuscar al cliente.
  const { data: fromPVDoc } = useQuery({
    queryKey: ['document', fromPVId],
    queryFn: () => getDocument(fromPVId!),
    enabled: Boolean(fromPVId) && !draftId,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!fromPVDoc) return
    if (!hasPendingItems(fromPVDoc)) {
      toast.error('Esta preventa ya no tiene cantidad pendiente por convertir')
      return
    }
    setPendingPreventa(fromPVDoc)
  }, [fromPVDoc])

  // NOTA DE CONTRATO: ConvertDocumentPayload.paymentMethod está tipado opcional, pero
  // documents.service.ts::convert() re-corre PosEffectStrategy.validateCreate() sobre el borrador
  // derivado antes de crearlo, y esa validación exige paymentMethod truthy (mismo chequeo que
  // create() para un POS nuevo) — un convert() sin forma de pago siempre responde 400. El botón de
  // abajo por eso queda deshabilitado hasta que paymentMethod tenga valor (ver disabled más abajo).
  const { mutate: doConvert, isPending: isConverting } = useMutation({
    mutationFn: (pvId: string) =>
      convertDocument(pvId, { targetType: 'POS', paymentMethod: paymentMethod || undefined }),
    onSuccess: (converted) => {
      setDraftId(converted.id)
      setDraftNumber(converted.number)
      setThirdPartyId(converted.thirdParty?.id ?? '')
      setTpSelectedName(converted.thirdParty?.name ?? '')
      setSellerId(converted.seller?.id ?? '')
      setSellerSelectedName(converted.seller?.name ?? '')
      replace(
        converted.documentItems.map((item) => ({
          productId: item.productId,
          productCode: item.product.code,
          productDesc: item.product.description,
          quantity: item.quantity,
          unitCost: undefined,
          unitPrice: item.unitPrice,
          observaciones: undefined,
        })),
      )
      setSourceDocument(converted.sourceDocument)
      const sourceLabel = converted.sourceDocument
        ? docNumber(converted.sourceDocument.type, converted.sourceDocument.number)
        : 'la preventa'
      setPendingPreventa(null)
      toast.success(`Venta creada a partir de ${sourceLabel}. Revisa los precios antes de confirmar.`)
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err) ?? 'Error al convertir la preventa')
    },
  })

  // ── búsqueda manual de producto (alternativa al escaneo) ─────────────────
  const [manualProductSearch, setManualProductSearch] = useState('')
  const [debouncedManualSearch] = useDebounce(manualProductSearch, 400)
  const hasManualSearch = debouncedManualSearch.length >= 1

  const { data: manualProductData, isLoading: isLoadingManualProducts } = useQuery({
    queryKey: ['products-search-pos', debouncedManualSearch],
    queryFn: () => getProducts({ search: debouncedManualSearch, page: 1, limit: 20 }),
    staleTime: 2 * 60 * 1000,
    enabled: hasManualSearch,
  })

  const manualProductOptions: ComboboxOption[] = (manualProductData?.items ?? []).map((p) => ({
    id: p.id,
    label: `${p.code} — ${p.description}`,
    sublabel: `Disponible: ${p.availableStock}`,
  }))

  function handleManualProductAdd(id: string) {
    const product = manualProductData?.items.find((p) => p.id === id)
    if (!product) return
    // Pre-siembra la caché de getProductByCode con el producto ya conocido — evita un round-trip
    // redundante para resolver minSalePrice/availableStock de esta misma fila (ver useQueries abajo).
    queryClient.setQueryData(['product-by-code', product.code], product)

    const currentItems = getValues('items')
    const existingIndex = currentItems.findIndex((item) => item.productId === id)
    if (existingIndex >= 0) {
      const currentQty = Number(currentItems[existingIndex].quantity) || 0
      setValue(`items.${existingIndex}.quantity`, currentQty + 1)
      toast.success(`${product.code} — cantidad +1`)
    } else {
      append({
        productId: product.id,
        productCode: product.code,
        productDesc: product.description,
        quantity: 1,
        unitCost: undefined,
        unitPrice: Number(product.salePrice),
        observaciones: undefined,
      })
      toast.success(`${product.code} agregado`)
    }
    setManualProductSearch('')
  }

  // ── detalle de producto por código (minSalePrice + disponible) ───────────
  // BarcodeScanInput solo entrega avgCost/unitOfMeasure/availableStock por su callback
  // onProductScanned (no minSalePrice, no el Product completo) — en vez de acoplarse a eso, se
  // resuelve el detalle completo de cada código presente en el carrito vía TanStack Query, cacheado
  // y compartido con la búsqueda manual (ver setQueryData arriba).
  const uniqueProductCodes = useMemo(
    () => Array.from(new Set(cartItems.map((i) => i.productCode).filter(Boolean))),
    [cartItems],
  )

  const productDetailQueries = useQueries({
    queries: uniqueProductCodes.map((code) => ({
      queryKey: ['product-by-code', code],
      queryFn: () => getProductByCode(code),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const productDetailByCode = useMemo(() => {
    const map = new Map<string, { minSalePrice: number; availableStock: number; id: string }>()
    productDetailQueries.forEach((q) => {
      if (q.data) map.set(q.data.code, q.data)
    })
    return map
  }, [productDetailQueries])

  const minSalePriceByProductId = useMemo(() => {
    const map = new Map<string, number>()
    productDetailByCode.forEach((p) => map.set(p.id, p.minSalePrice))
    return map
  }, [productDetailByCode])

  const priceFloorViolations = findPriceFloorViolations(
    cartItems.filter((i) => i.productId).map((i) => ({
      productId: i.productId,
      code: i.productCode,
      unitPrice: Number(i.unitPrice ?? 0),
    })),
    minSalePriceByProductId,
  )

  // ── total + validaciones ──────────────────────────────────────────────────
  const total = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0)
  const hasValidItems = fields.length > 0 && cartItems.every((item) => item.productId && Number(item.quantity) > 0)

  const missingItems: string[] = []
  if (!thirdPartyId) missingItems.push('Selecciona un cliente')
  if (!sellerId) missingItems.push('Selecciona una vendedora')
  if (!paymentMethod) missingItems.push('Selecciona una forma de pago')
  if (!hasValidItems) missingItems.push('Agrega al menos un producto con cantidad válida')
  if (priceFloorViolations.length > 0) missingItems.push('Corrige los precios por debajo del mínimo permitido')

  const canConfirm = missingItems.length === 0

  // ── mutaciones de guardado/confirmación ───────────────────────────────────
  const [shortfalls, setShortfalls] = useState<StockShortfall[] | null>(null)

  const { mutateAsync: createMutateAsync, isPending: isCreating } = useMutation({ mutationFn: createDocument })
  const { mutateAsync: updateMutateAsync, isPending: isUpdating } = useMutation({
    mutationFn: ({ docId, payload }: { docId: string; payload: UpdateDocumentPayload }) => updateDocument(docId, payload),
  })
  const { mutateAsync: confirmMutateAsync, isPending: isConfirming } = useMutation({ mutationFn: confirmDocument })

  const isSubmitting = isCreating || isUpdating || isConfirming

  const invalidateAfterSale = (confirmed: Document) => {
    queryClient.invalidateQueries({ queryKey: ['documents'] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['products-search'] })
    if (confirmed.sourceDocument) {
      queryClient.invalidateQueries({ queryKey: ['document', confirmed.sourceDocument.id] })
    }
  }

  async function handleConfirm() {
    if (!canConfirm) return

    const items = cartItems.map((i) => ({
      productId: i.productId,
      quantity: Number(i.quantity),
      unitPrice: i.unitPrice !== undefined && !Number.isNaN(Number(i.unitPrice)) ? Number(i.unitPrice) : undefined,
    }))
    const payload: UpdateDocumentPayload = {
      date: TODAY,
      thirdPartyId,
      sellerId,
      paymentMethod: paymentMethod as PaymentMethod,
      items,
    }

    let doc: Document
    try {
      if (draftId) {
        doc = await updateMutateAsync({ docId: draftId, payload })
      } else {
        doc = await createMutateAsync({ type: 'POS', ...payload })
        setDraftId(doc.id)
        setDraftNumber(doc.number)
      }
    } catch (err) {
      toast.error(extractErrorMessage(err) ?? 'Error al guardar la venta')
      return
    }

    try {
      const confirmed = await confirmMutateAsync(doc.id)
      invalidateAfterSale(confirmed)
      toast.success(`Venta ${docNumber(confirmed.type, confirmed.number)} confirmada. El inventario fue actualizado.`)
      navigate(`/documents/${confirmed.id}`)
    } catch (err) {
      const parsedShortfalls = parseStockShortfallError(err)
      if (parsedShortfalls) {
        setShortfalls(parsedShortfalls)
        return
      }
      toast.error(extractErrorMessage(err) ?? 'Error al confirmar la venta')
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/documents')}
          className="p-2 rounded-xl text-content-faint hover:text-content hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', accent.iconBg)}>
          <accent.icon className={cn('w-6 h-6', accent.iconText)} />
        </div>
        <div>
          <h1 className="text-2xl text-content">Nueva venta</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">
            {draftId && draftNumber !== null
              ? `Borrador ${docNumber('POS', draftNumber)} en curso`
              : 'Venta de contado'}
          </p>
        </div>
        {sourceDocument && (
          <span className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Convertida desde {docNumber(sourceDocument.type, sourceDocument.number)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Columna principal ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos de la venta */}
          <div className={cn('bg-surface rounded-2xl border border-ui-border shadow-sm p-6 space-y-5 border-l-4', accent.border)}>
            <h2 className="text-base text-content border-b border-ui-divide pb-3">Datos de la venta</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                  <User className="w-3.5 h-3.5" />
                  Cliente <span className="text-red-500">*</span>
                </label>
                <Combobox
                  value={thirdPartyId}
                  onChange={(id, option) => { void handleCustomerSelected(id, option.label) }}
                  options={tpDisplayOptions}
                  isLoading={isLoadingTp}
                  placeholder="Selecciona un cliente..."
                  searchValue={tpSearch}
                  onSearchChange={setTpSearch}
                />
                {checkingPreventa && (
                  <p className="text-xs text-content-faint font-accent">Buscando preventas activas...</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                  <UserCog className="w-3.5 h-3.5" />
                  Vendedora <span className="text-red-500">*</span>
                </label>
                <Combobox
                  value={sellerId}
                  onChange={(id, option) => { setSellerId(id); setSellerSelectedName(option.label) }}
                  options={sellerDisplayOptions}
                  isLoading={isLoadingSeller}
                  placeholder="Selecciona una vendedora..."
                  searchValue={sellerSearch}
                  onSearchChange={setSellerSearch}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="flex items-center gap-1.5 text-sm font-medium text-content-secondary">
                  <Wallet className="w-3.5 h-3.5" />
                  Forma de pago <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full sm:w-64 px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary border-ui-border-medium"
                >
                  <option value="">Selecciona una forma de pago</option>
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Aviso de preventa activa */}
          {pendingPreventa && (
            <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
              <ArrowRightLeft className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                  {pendingPreventa.thirdParty?.name ?? 'Este cliente'} tiene una preventa activa (
                  {docNumber(pendingPreventa.type, pendingPreventa.number)}) con productos pendientes por convertir.
                </p>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/70 mt-1 font-accent">
                  Se creará una venta nueva con los mismos ítems y precios cotizados de esa preventa.
                  {fields.length > 0 && ` Esto reemplazará los ${fields.length} producto(s) ya agregados al carrito.`}
                </p>
                {!paymentMethod && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                    Selecciona una forma de pago arriba antes de convertir — la venta la requiere.
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => doConvert(pendingPreventa.id)}
                    disabled={isConverting || !paymentMethod}
                    title={!paymentMethod ? 'Selecciona una forma de pago primero' : undefined}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white rounded-lg gradient-action hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isConverting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Convertir a esta venta
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPreventa(null)}
                    className="text-xs font-medium text-content-muted hover:text-content transition-colors"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Productos */}
          <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-ui-divide">
              <h2 className="text-base text-content">Productos</h2>
              <p className="text-xs text-content-faint font-accent mt-0.5">Escanea o busca para agregar</p>
            </div>

            <BarcodeScanInput
              docType="POS"
              append={append}
              getValues={getValues}
              setValue={setValue}
              onProductScanned={() => {}}
              focusQuantityInput={() => {}}
              supplierBrandIds={undefined}
            />

            <div className="px-6 py-4 border-b border-ui-divide">
              <label className="block text-xs font-semibold text-content-faint uppercase tracking-wider mb-1.5">
                Búsqueda manual
              </label>
              <div className="max-w-sm">
                <Combobox
                  value=""
                  onChange={(id) => handleManualProductAdd(id)}
                  options={manualProductOptions}
                  isLoading={isLoadingManualProducts}
                  placeholder="Buscar producto por nombre o código..."
                  searchValue={manualProductSearch}
                  onSearchChange={setManualProductSearch}
                />
              </div>
            </div>

            {fields.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingBag className="w-8 h-8 text-content-faint mx-auto mb-2" />
                <p className="text-content-muted text-sm">El carrito está vacío. Escanea o busca un producto.</p>
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
                        Precio unit.
                      </th>
                      <th className="text-right text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3 w-32">
                        Subtotal
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
                          watch={watch}
                          onRemove={() => remove(index)}
                          minSalePrice={detail?.minSalePrice}
                          availableStock={detail?.availableStock}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Resumen (sticky) ──────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6 space-y-4">
            <div>
              <p className="text-xs text-content-faint font-accent uppercase tracking-wider">Total a pagar</p>
              <p className="text-4xl text-content mt-1 font-mono">{formatCOP(total)}</p>
              <p className="text-xs text-content-muted mt-1 font-accent">
                {fields.length} producto{fields.length === 1 ? '' : 's'}
              </p>
            </div>

            {missingItems.length > 0 && (
              <ul className="space-y-1.5 text-xs text-amber-600 dark:text-amber-400 border-t border-ui-divide pt-4">
                {missingItems.map((m) => (
                  <li key={m} className="flex items-start gap-1.5">
                    <span className="mt-0.5">•</span>
                    {m}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => { void handleConfirm() }}
              disabled={!canConfirm || isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white rounded-xl gradient-action hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar venta
            </button>
            <button
              type="button"
              onClick={() => navigate('/documents')}
              className="w-full px-4 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {shortfalls && <POSStockShortfallDialog shortfalls={shortfalls} onClose={() => setShortfalls(null)} />}
    </div>
  )
}
