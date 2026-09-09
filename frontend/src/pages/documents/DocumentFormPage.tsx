import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useDebounce } from 'use-debounce'
import { ArrowLeft, Plus, Loader2, Info } from 'lucide-react'

import { getDocument, createDocument, updateDocument } from '@/services/documents.service'
import { getWarehouses, getWarehouse } from '@/services/warehouses.service'
import { getThirdParties } from '@/services/third-parties.service'
import { useAuthStore } from '@/stores/auth.store'
import { Combobox } from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { cn } from '@/lib/utils'
import { getFirstErrorMessage } from '@/lib/form-errors'
import { formSchema, type FormValues } from './document-form.schema'
import { DOC_TYPE_SELECT_OPTIONS, DOC_TYPE_ACCENT, EAI_ADJUSTMENT_REASON_OPTIONS } from './document.constants'
import { ProductRow } from './components/ProductRow'
import { BarcodeScanInput } from './components/BarcodeScanInput'

import type { Warehouse, WarehouseDetail } from '@/types/warehouse.types'
import type { ThirdParty } from '@/types/third-party.types'

// ─── constants ───────────────────────────────────────────────────────────────

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v)

const DOC_TYPE_OPTIONS = DOC_TYPE_SELECT_OPTIONS

const TODAY = new Date().toISOString().slice(0, 10)

// Sustantivo por tipo para títulos y botones: solo la remisión tiene texto propio; el resto usa "operación".
const TYPE_NOUN: Record<string, string> = { REM: 'remisión' }
const nounFor = (t: string) => TYPE_NOUN[t] ?? 'operación'

// ─── main page ───────────────────────────────────────────────────────────────

export default function DocumentFormPage() {
  const navigate    = useNavigate()
  const { id }      = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEditing   = Boolean(id)
  const queryClient = useQueryClient()

  const userPermissions = useAuthStore((s) => s.user?.permissions ?? [])
  const canCreateType = (t: string) => userPermissions.includes(`document.create.${t}`)

  // Tipos que NO salen en el desplegable "Tipo de operación": las ventas tienen su propia
  // pantalla de checkout; la remisión se crea solo desde el enlace "Nueva remisión" del menú,
  // con el tipo ya fijado, para que no parezca "una operación de inventario más".
  const availableTypes = DOC_TYPE_OPTIONS.filter(
    (opt) => opt.value !== 'POS' && opt.value !== 'COT' && opt.value !== 'REM' && canCreateType(opt.value)
  )

  // Tipos que solo se pueden crear desde un enlace directo, no desde el desplegable.
  const DEEP_LINK_TYPES: readonly FormValues['type'][] = ['REM']
  const requestedType = searchParams.get('type') as FormValues['type'] | null
  const requestedTypeAllowed =
    requestedType != null &&
    canCreateType(requestedType) &&
    (DEEP_LINK_TYPES.includes(requestedType) || availableTypes.some((opt) => opt.value === requestedType))
  const defaultType = (
    requestedTypeAllowed ? requestedType : availableTypes[0]?.value ?? 'CM'
  ) as FormValues['type']

  // Si el enlace pide crear un tipo para el que el usuario no tiene permiso, no romper:
  // mandarlo al listado. Al editar, el tipo lo fija el documento existente.
  useEffect(() => {
    if (isEditing || !requestedType || canCreateType(requestedType)) return
    toast.error('No tienes permiso para crear este tipo de documento')
    navigate('/documents', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedType, isEditing])

  // Búsqueda de tercero: proveedor en compras y devoluciones, cliente en preventas y remisiones.
  const [tpSearch, setTpSearch] = useState('')
  const [debouncedTpSearch] = useDebounce(tpSearch, 400)
  const [tpSelectedName, setTpSelectedName] = useState('')
  // Marcas activas del proveedor elegido (solo compras y devoluciones): el buscador y el
  // escaneo de productos quedan restringidos a esas marcas.
  const [selectedSupplierBrandIds, setSelectedSupplierBrandIds] = useState<string[]>([])
  // Condiciones de descuento del proveedor elegido, solo informativas (no se calcula nada).
  // Se muestran en un aviso, solo en compras.
  const [selectedSupplierDiscountNotes, setSelectedSupplierDiscountNotes] = useState<string | undefined>()

  // Vendedora: solo preventas y remisiones.
  const [sellerSearch, setSellerSearch] = useState('')
  const [debouncedSellerSearch] = useDebounce(sellerSearch, 400)
  const [sellerSelectedName, setSellerSelectedName] = useState('')

  // Costo promedio, unidad de medida y disponible de cada producto, tal como estaban al
  // agregarlo por escaneo. Sirve para que la fila muestre esos datos aunque el producto no se
  // haya elegido desde su propio buscador. El disponible es opcional: al reabrir un borrador
  // para editar no hay un valor guardado equivalente (y mostrar el "actual" engañaría, porque
  // esas líneas ya están reservando stock), así que queda vacío hasta que el buscador de la
  // fila lo resuelva.
  const [scannedProductInfo, setScannedProductInfo] = useState<
    Record<string, { avgCost: number; unitOfMeasure: 'unidad' | 'docena'; availableStock?: number }>
  >({})

  // Ciclo de foco del lector de código de barras: escanear → cantidad → escanear. La lista de
  // referencias a los inputs cambia con cada fila que se agrega o quita, así que va en useRef,
  // no en useState: modificarla nunca debe provocar un re-render.
  const quantityInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const barcodeInputRef = useRef<{ focus: () => void }>(null)
  const [pendingQuantityFocusIndex, setPendingQuantityFocusIndex] = useState<number | null>(null)

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      type:  defaultType,
      date:  TODAY,
      items: [],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })

  // React garantiza que las referencias del árbol ya están conectadas antes de correr los
  // efectos de ese mismo render, así que este efecto siempre encuentra el input de cantidad
  // montado. Se incluye `fields` en las dependencias: si el índice pendiente se fija en el
  // mismo momento en que se agrega la fila, el efecto se vuelve a evaluar cuando la fila
  // aparece de verdad en pantalla.
  useEffect(() => {
    if (pendingQuantityFocusIndex === null) return
    quantityInputRefs.current.get(pendingQuantityFocusIndex)?.focus()
    setPendingQuantityFocusIndex(null)
  }, [pendingQuantityFocusIndex, fields])

  const docType         = watch('type')
  const warehouseId     = watch('warehouseId')
  const destWarehouseId = watch('destWarehouseId')
  // Ícono y color de acento del encabezado; se recalculan en vivo al cambiar el tipo de operación.
  const accent          = DOC_TYPE_ACCENT[docType]

  // ── load existing document for edit ──────────────────────────────────────
  const { data: existingDoc, isLoading: isLoadingDoc } = useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(id!),
    enabled: isEditing,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!existingDoc) return
    if (existingDoc.status !== 'draft') {
      toast.error('Solo se pueden editar operaciones en estado borrador')
      navigate(`/documents/${existingDoc.id}`)
      return
    }
    // Un borrador de venta (creado desde el checkout y todavía sin confirmar) no se edita en
    // este form genérico: acá no hay selección de cliente, vendedora, forma de pago ni cupo,
    // ni columna de precio para esos tipos. Se retoma desde el checkout, no acá.
    if (existingDoc.type === 'POS' || existingDoc.type === 'COT') {
      toast.error('Las ventas se editan desde el checkout, no desde este formulario')
      navigate(`/documents/${existingDoc.id}`)
      return
    }
    setTpSelectedName(existingDoc.thirdParty?.name ?? '')
    setSellerSelectedName(existingDoc.seller?.name ?? '')
    setSelectedSupplierBrandIds(existingDoc.thirdParty?.supplier?.brands.map((b) => b.id) ?? [])
    setSelectedSupplierDiscountNotes(existingDoc.thirdParty?.supplier?.discountNotes ?? undefined)
    setScannedProductInfo(
      Object.fromEntries(
        existingDoc.documentItems.map((item) => [
          item.productId,
          {
            avgCost: Number(item.product.avgCost),
            unitOfMeasure: item.product.unitOfMeasure,
          },
        ]),
      ),
    )
    reset({
      type:            existingDoc.type,
      date:            existingDoc.date.slice(0, 10),
      thirdPartyId:    existingDoc.thirdParty?.id ?? undefined,
      sellerId:        existingDoc.seller?.id ?? undefined,
      warehouseId:     existingDoc.warehouse?.id ?? undefined,
      sourceBinId:     existingDoc.sourceBin?.id ?? undefined,
      destWarehouseId: existingDoc.destWarehouse?.id ?? undefined,
      destBinId:       existingDoc.destBin?.id ?? undefined,
      adjustmentReason:      existingDoc.adjustmentReason ?? undefined,
      adjustmentReasonOther: existingDoc.adjustmentReasonOther ?? undefined,
      notes:           existingDoc.notes ?? undefined,
      items: existingDoc.documentItems.map((item) => ({
        productId:     item.productId,
        productCode:   item.product.code,
        productDesc:   item.product.description,
        quantity:      item.quantity,
        unitCost:      item.unitCost ?? undefined,
        unitPrice:     item.unitPrice ?? undefined,
        observaciones: item.observaciones ?? undefined,
      })),
    })
  }, [existingDoc, reset, navigate])

  // ── catalogues ────────────────────────────────────────────────────────────
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: getWarehouses,
    staleTime: 10 * 60 * 1000,
  })

  // CM/DVC piden proveedor; PV y REM piden cliente — mismo combobox, distinto filtro server-side.
  const needsSupplier = docType === 'CM' || docType === 'DVC'
  const needsCustomer = docType === 'PV' || docType === 'REM'
  const needsSeller    = docType === 'PV' || docType === 'REM'

  const hasTpSearch = debouncedTpSearch.length >= 1

  const { data: tpData, isLoading: isLoadingTp } = useQuery({
    queryKey: ['third-parties-search', debouncedTpSearch, needsCustomer],
    queryFn: () =>
      getThirdParties({
        search: debouncedTpSearch || undefined,
        page: 1,
        limit: 30,
        isSupplier: needsSupplier ? true : undefined,
        isCustomer: needsCustomer ? true : undefined,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: (needsSupplier || needsCustomer) && hasTpSearch,
  })

  const hasSellerSearch = debouncedSellerSearch.length >= 1

  const { data: sellerData, isLoading: isLoadingSeller } = useQuery({
    queryKey: ['third-parties-search-seller', debouncedSellerSearch],
    queryFn: () =>
      getThirdParties({ search: debouncedSellerSearch || undefined, page: 1, limit: 30, isSeller: true }),
    staleTime: 2 * 60 * 1000,
    enabled: needsSeller && hasSellerSearch,
  })

  // Carga el detalle de la bodega origen para la cascada zona/bulto (solo en traslados).
  const { data: sourceWarehouseDetail, isLoading: isLoadingSourceDetail } = useQuery({
    queryKey: ['warehouse-detail', warehouseId],
    queryFn: () => getWarehouse(warehouseId!),
    enabled: docType === 'T' && Boolean(warehouseId),
    staleTime: 5 * 60 * 1000,
  })

  // Carga el detalle de la bodega destino para la cascada zona/bulto (solo en traslados).
  const { data: destWarehouseDetail, isLoading: isLoadingDestDetail } = useQuery({
    queryKey: ['warehouse-detail', destWarehouseId],
    queryFn: () => getWarehouse(destWarehouseId!),
    enabled: docType === 'T' && Boolean(destWarehouseId),
    staleTime: 5 * 60 * 1000,
  })

  // Cada bulto pertenece a una bodega concreta. Si cambia la bodega origen, el bulto ya
  // elegido casi seguro deja de ser válido, así que se limpia junto con la zona.
  useEffect(() => {
    setValue('sourceBinId', undefined)
  }, [warehouseId, setValue])

  // Mismo motivo que el efecto anterior, pero para la bodega destino.
  useEffect(() => {
    setValue('destBinId', undefined)
  }, [destWarehouseId, setValue])

  // Origen y destino no pueden ser la misma bodega. El selector de destino ya oculta la
  // opción igual al origen, pero si el usuario cambia el origen DESPUÉS de elegir destino,
  // el destino queda apuntando a algo que ya no se ve y arrastraría una cascada zona/bulto
  // fantasma. Al limpiarlo, los efectos de arriba encadenan el reinicio de bulto y zona.
  useEffect(() => {
    if (destWarehouseId && destWarehouseId === warehouseId) {
      setValue('destWarehouseId', undefined)
    }
  }, [warehouseId, destWarehouseId, setValue])

  // Solo las bodegas físicas llevan seguimiento por bulto; los almacenes de venta no tienen
  // ese detalle, así que el traslado no pide zona ni bulto cuando el origen es un almacén.
  const sourceRequiresBin =
    docType === 'T' &&
    Boolean(warehouseId) &&
    warehouses.find((w: Warehouse) => w.id === warehouseId)?.type === 'warehouse'

  // Mismo criterio, aplicado a la bodega destino.
  const destRequiresBin =
    docType === 'T' &&
    Boolean(destWarehouseId) &&
    warehouses.find((w: Warehouse) => w.id === destWarehouseId)?.type === 'warehouse'

  const sourceZones = (sourceWarehouseDetail as WarehouseDetail | undefined)?.zones ?? []
  const destZones = (destWarehouseDetail as WarehouseDetail | undefined)?.zones ?? []

  const [selectedSourceZoneId, setSelectedSourceZoneId] = useState('')
  useEffect(() => { setSelectedSourceZoneId('') }, [warehouseId])

  const [selectedZoneId, setSelectedZoneId] = useState('')
  useEffect(() => { setSelectedZoneId('') }, [destWarehouseId])

  const currentSourceBinId = watch('sourceBinId')
  const currentDestBinId = watch('destBinId')

  // Productos actualmente en el documento — un bulto origen solo califica si ya tiene stock
  // de alguno de estos productos (normalmente se traslada un solo producto por bulto).
  const watchedItems = watch('items')
  const itemProductIds = new Set(
    (watchedItems ?? []).map((item) => item.productId).filter((pid): pid is string => Boolean(pid)),
  )

  const sourceBins = (() => {
    const baseBins = selectedSourceZoneId
      ? sourceZones.find((z) => z.id === selectedSourceZoneId)?.bins ?? []
      : sourceZones.flatMap((z) => z.bins)

    const available = baseBins.filter((bin) =>
      bin.binStocks.some((bs) => bs.quantity > 0 && itemProductIds.has(bs.productId)),
    )

    // Si el bulto ya elegido (p. ej. al editar un borrador) dejó de pasar el filtro de arriba
    // porque desde entonces se agregó o quitó un ítem, igual se vuelve a meter en la lista
    // para que el selector no quede apuntando a una opción que no existe.
    if (currentSourceBinId && !available.some((b) => b.id === currentSourceBinId)) {
      const staleSelected = baseBins.find((b) => b.id === currentSourceBinId)
      if (staleSelected) return [...available, staleSelected]
    }

    return available
  })()

  const destBins = (() => {
    const baseBins = selectedZoneId
      ? destZones.find((z) => z.id === selectedZoneId)?.bins ?? []
      : destZones.flatMap((z) => z.bins)

    // "occupied" lo calcula el backend en vivo (tiene stock > 0), no es un interruptor manual.
    // Un bulto ya ocupado por un traslado anterior no debe recibir otro hasta que se vacíe;
    // se libera solo. El panel de administración de bodegas sí muestra todos los bultos.
    // Excepción: un bulto ocupado sigue sirviendo si todo lo que contiene coincide con los
    // productos que ya tiene este documento — eso es apilar el mismo producto, no mezclar.
    // Un bulto solo puede tener un producto a la vez; el backend lo valida de verdad, este
    // filtro es solo una ayuda visual.
    const available = baseBins.filter((bin) =>
      !bin.occupied || bin.binStocks.every((bs) => itemProductIds.has(bs.productId)),
    )

    // Mismo motivo que en los bultos de origen: mantener visible el bulto ya elegido aunque
    // ya no pase el filtro, para no dejar el selector apuntando a una opción inexistente.
    if (currentDestBinId && !available.some((b) => b.id === currentDestBinId)) {
      const staleSelected = baseBins.find((b) => b.id === currentDestBinId)
      if (staleSelected) return [...available, staleSelected]
    }

    return available
  })()

  // Opciones de tercero: proveedor en compras y devoluciones, cliente en preventas y remisiones.
  const tpOptions: ComboboxOption[] = (tpData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
    sublabel: needsCustomer ? undefined : tp.isSupplier ? 'Proveedor' : undefined,
  }))

  const currentTpId = watch('thirdPartyId') ?? ''

  const tpDisplayOptions: ComboboxOption[] = currentTpId && !debouncedTpSearch
    ? [{ id: currentTpId, label: tpSelectedName }, ...tpOptions.filter((o) => o.id !== currentTpId)]
    : tpOptions

  // Opciones de vendedora: solo preventas y remisiones.
  const sellerOptions: ComboboxOption[] = (sellerData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
  }))

  const currentSellerId = watch('sellerId') ?? ''

  const sellerDisplayOptions: ComboboxOption[] = currentSellerId && !debouncedSellerSearch
    ? [{ id: currentSellerId, label: sellerSelectedName }, ...sellerOptions.filter((o) => o.id !== currentSellerId)]
    : sellerOptions

  // ── mutations ─────────────────────────────────────────────────────────────
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['documents'] })
  }, [queryClient])

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: createDocument,
    onSuccess: (doc) => {
      invalidate()
      toast.success('Operación creada correctamente')
      navigate(`/documents/${doc.id}`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Error al crear la operación')
    },
  })

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: ({ docId, payload }: { docId: string; payload: Parameters<typeof updateDocument>[1] }) =>
      updateDocument(docId, payload),
    onSuccess: (doc) => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['document', id] })
      toast.success('Operación actualizada correctamente')
      navigate(`/documents/${doc.id}`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Error al actualizar la operación')
    },
  })

  const isPending = isCreating || isUpdating

  // ── submit ────────────────────────────────────────────────────────────────
  const onSubmit = (values: FormValues) => {
    const payload = {
      type:            values.type,
      date:            values.date,
      thirdPartyId:    values.thirdPartyId || undefined,
      sellerId:        (values.type === 'PV' || values.type === 'REM') ? (values.sellerId || undefined) : undefined,
      warehouseId:     values.type === 'T' ? (values.warehouseId || undefined) : undefined,
      sourceBinId:     values.sourceBinId || undefined,
      destWarehouseId: values.destWarehouseId || undefined,
      destBinId:       values.destBinId || undefined,
      adjustmentReason:
        values.type === 'EAI' ? (values.adjustmentReason || undefined) : undefined,
      // Se manda null explícito (no undefined) cuando el motivo no es "otro": al serializar,
      // las claves undefined se quitan del cuerpo, y un texto viejo de "otro motivo" quedaría
      // guardado en la base si el motivo cambia de categoría antes de guardar.
      adjustmentReasonOther:
        values.type === 'EAI' && values.adjustmentReason === 'otro'
          ? (values.adjustmentReasonOther || undefined)
          : null,
      notes:           values.notes || undefined,
      items: values.items.map((item) => ({
        productId:     item.productId,
        quantity:      item.quantity,
        unitCost:      item.unitCost !== undefined && !isNaN(item.unitCost) ? item.unitCost : undefined,
        unitPrice:     item.unitPrice !== undefined && !isNaN(item.unitPrice) ? item.unitPrice : undefined,
        observaciones: item.observaciones || undefined,
      })),
    }

    if (isEditing && id) {
      const { type: _type, ...rest } = payload
      update({ docId: id, payload: rest })
    } else {
      create(payload)
    }
  }

  // ── loading state ─────────────────────────────────────────────────────────
  if (isEditing && isLoadingDoc) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-hover animate-pulse" />
          <div className="w-48 h-7 rounded-lg bg-surface-hover animate-pulse" />
        </div>
        <div className="bg-surface rounded-2xl border border-ui-border p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-hover animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  const needsThirdParty = needsSupplier || needsCustomer
  const needsTransfer   = docType === 'T'
  const needsAdjustmentReason = docType === 'EAI'
  const currentAdjustmentReason = watch('adjustmentReason')
  const showCostColumn  = docType === 'CM' || docType === 'DVC' || docType === 'EAI'
  // Preventas y remisiones muestran precio de venta editable en vez de costo: es una columna aparte.
  const showPriceColumn = docType === 'PV' || docType === 'REM'
  // Las salidas por ajuste y los traslados también necesitan la columna de costo (de solo
  // lectura) para que las celdas de cada fila sigan alineadas con el encabezado.
  const hasCostColumn   = showCostColumn || showPriceColumn || docType === 'SAJ' || docType === 'T'
  // Nota de talla por línea: solo en traslados.
  const showObservacionesColumn = docType === 'T'

  return (
    <div className="space-y-6 pb-10">
      {/* Encabezado */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(isEditing ? `/documents/${id}` : '/documents')}
          className="p-2 rounded-xl text-content-faint hover:text-content hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', accent.iconBg)}>
          <accent.icon className={cn('w-6 h-6', accent.iconText)} />
        </div>
        <div>
          <h1 className="text-2xl text-content">
            {isEditing ? `Editar ${nounFor(docType)}` : `Nueva ${nounFor(docType)}`}
          </h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">
            {isEditing
              ? 'Editando borrador'
              : docType === 'REM'
                ? 'Crea una nueva remisión'
                : 'Crea una nueva operación de inventario'}
          </p>
        </div>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form
        onSubmit={handleSubmit(onSubmit as any, (formErrors) => toast.error(getFirstErrorMessage(formErrors)))}
        noValidate
        className="space-y-6"
      >
        {/* ── Datos generales — borde de acento izquierdo según el tipo, ancla visual del form ── */}
        <div className={cn(
          'bg-surface rounded-2xl border border-ui-border shadow-sm p-6 space-y-5 border-l-4',
          accent.border
        )}>
          <h2 className="text-base text-content border-b border-ui-divide pb-3">
            Información general
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Tipo — la remisión va con tipo fijo (no editable); el resto usa el desplegable */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-content-secondary">
                Tipo de operación {docType !== 'REM' && <span className="text-red-500">*</span>}
              </label>
              {docType === 'REM' ? (
                <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-ui-border-medium bg-surface-raised text-content opacity-90">
                  <span className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0', accent.iconBg)}>
                    <accent.icon className={cn('w-4 h-4', accent.iconText)} />
                  </span>
                  Remisión
                </div>
              ) : (
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    disabled={isEditing}
                    onChange={(e) => {
                      field.onChange(e)
                      setValue('thirdPartyId', undefined)
                      setValue('sellerId', undefined)
                      setValue('warehouseId', undefined)
                      setValue('sourceBinId', undefined)
                      setValue('destWarehouseId', undefined)
                      setValue('destBinId', undefined)
                      setValue('adjustmentReason', undefined)
                      setValue('adjustmentReasonOther', undefined)
                      setTpSelectedName('')
                      setSellerSelectedName('')
                      setSelectedSupplierBrandIds([])
                      setSelectedSupplierDiscountNotes(undefined)
                      replace([])
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary',
                      isEditing ? 'opacity-60 cursor-not-allowed' : 'border-ui-border-medium',
                    )}
                  >
                    {availableTypes.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              />
              )}
            </div>

            {/* Fecha */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-content-secondary">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('date')}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary border-ui-border-medium"
              />
            </div>

            {/* Tercero — proveedor en compras y devoluciones, cliente en preventas y remisiones */}
            {needsThirdParty && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-content-secondary">
                  {needsCustomer ? 'Cliente' : 'Proveedor'} <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="thirdPartyId"
                  control={control}
                  render={({ field }) => (
                    <Combobox
                      value={field.value ?? ''}
                      onChange={(selectedId, option) => {
                        field.onChange(selectedId)
                        setTpSelectedName(option.label)

                        const tp = tpData?.items.find((t: ThirdParty) => t.id === selectedId)
                        setSelectedSupplierBrandIds(tp?.supplier?.brands.map((b) => b.id) ?? [])
                        setSelectedSupplierDiscountNotes(tp?.supplier?.discountNotes ?? undefined)

                        // Cambiar de proveedor con ítems ya cargados invalida la marca de todos
                        // ellos, así que se vacían (igual que al cambiar el tipo de documento).
                        // Este mismo buscador sirve para elegir cliente en preventas y remisiones,
                        // que no filtran por marca: ahí no se debe vaciar el carrito.
                        if (needsSupplier && getValues('items').length > 0) {
                          replace([])
                        }
                      }}
                      options={tpDisplayOptions}
                      isLoading={isLoadingTp}
                      placeholder={needsCustomer ? 'Selecciona un cliente...' : 'Selecciona un proveedor...'}
                      searchValue={tpSearch}
                      onSearchChange={setTpSearch}
                    />
                  )}
                />
                {docType === 'CM' && selectedSupplierDiscountNotes && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium">Condiciones de descuento</p>
                      <p className="font-accent mt-0.5 whitespace-pre-wrap">{selectedSupplierDiscountNotes}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Vendedora — solo preventas y remisiones */}
            {needsSeller && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-content-secondary">
                  Vendedora <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="sellerId"
                  control={control}
                  render={({ field }) => (
                    <Combobox
                      value={field.value ?? ''}
                      onChange={(selectedId, option) => {
                        field.onChange(selectedId)
                        setSellerSelectedName(option.label)
                      }}
                      options={sellerDisplayOptions}
                      isLoading={isLoadingSeller}
                      placeholder="Selecciona una vendedora..."
                      searchValue={sellerSearch}
                      onSearchChange={setSellerSearch}
                    />
                  )}
                />
              </div>
            )}

            {/* Traslado: bodega origen y destino */}
            {needsTransfer && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-content-secondary">
                    Bodega origen <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="warehouseId"
                    control={control}
                    render={({ field }) => (
                      <select
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary border-ui-border-medium"
                      >
                        <option value="">Selecciona bodega origen</option>
                        {warehouses.map((w: Warehouse) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                </div>

                {/* Cascada zona + bulto cuando el origen es una bodega física */}
                {sourceRequiresBin && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        Zona origen <span className="text-red-500">*</span>
                      </label>
                      {isLoadingSourceDetail ? (
                        <div className="h-9 rounded-lg bg-surface-hover animate-pulse" />
                      ) : (
                        <select
                          value={selectedSourceZoneId}
                          onChange={(e) => {
                            setSelectedSourceZoneId(e.target.value)
                            setValue('sourceBinId', undefined)
                          }}
                          className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised border-ui-border-medium text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
                        >
                          <option value="">Selecciona una zona</option>
                          {sourceZones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        Bulto origen <span className="text-red-500">*</span>
                      </label>
                      <Controller
                        name="sourceBinId"
                        control={control}
                        render={({ field }) => (
                          <select
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value)}
                            disabled={!selectedSourceZoneId}
                            className={cn(
                              'w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all',
                              'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary',
                              !selectedSourceZoneId && 'opacity-50 cursor-not-allowed',
                              'border-ui-border-medium',
                            )}
                          >
                            <option value="">Selecciona un bulto</option>
                            {sourceBins.map((b) => (
                              <option key={b.id} value={b.id}>
                                Bulto {b.code}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-content-secondary">
                    Bodega destino <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="destWarehouseId"
                    control={control}
                    render={({ field }) => (
                      <select
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary border-ui-border-medium"
                      >
                        <option value="">Selecciona bodega destino</option>
                        {warehouses
                          .filter((w: Warehouse) => w.id !== warehouseId)
                          .map((w: Warehouse) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                      </select>
                    )}
                  />
                </div>

                {/* Cascada zona + bulto cuando el destino es una bodega física */}
                {destRequiresBin && (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        Zona destino <span className="text-red-500">*</span>
                      </label>
                      {isLoadingDestDetail ? (
                        <div className="h-9 rounded-lg bg-surface-hover animate-pulse" />
                      ) : (
                        <select
                          value={selectedZoneId}
                          onChange={(e) => {
                            setSelectedZoneId(e.target.value)
                            setValue('destBinId', undefined)
                          }}
                          className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised border-ui-border-medium text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
                        >
                          <option value="">Selecciona una zona</option>
                          {destZones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-content-secondary">
                        Bulto destino <span className="text-red-500">*</span>
                      </label>
                      <Controller
                        name="destBinId"
                        control={control}
                        render={({ field }) => (
                          <select
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value)}
                            disabled={!selectedZoneId}
                            className={cn(
                              'w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all',
                              'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary',
                              !selectedZoneId && 'opacity-50 cursor-not-allowed',
                              'border-ui-border-medium',
                            )}
                          >
                            <option value="">Selecciona un bulto</option>
                            {destBins.map((b) => (
                              <option key={b.id} value={b.id}>
                                Bulto {b.code}
                                {b.occupied ? ' (ocupado — ya asignado a este borrador)' : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Motivo del ajuste (solo entradas por ajuste) */}
            {needsAdjustmentReason && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-content-secondary">
                  Motivo del ajuste <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('adjustmentReason')}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary border-ui-border-medium"
                >
                  <option value="">Selecciona un motivo</option>
                  {EAI_ADJUSTMENT_REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Detalle del motivo — solo en entradas por ajuste cuando el motivo es "Otro" */}
          {needsAdjustmentReason && currentAdjustmentReason === 'otro' && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-content-secondary">
                Explica el motivo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={300}
                placeholder="Describe el motivo real del ajuste..."
                {...register('adjustmentReasonOther')}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised border-ui-border-medium text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
              />
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-content-secondary">
              Notas
            </label>
            <textarea
              rows={2}
              {...register('notes')}
              placeholder="Observaciones opcionales..."
              className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised border-ui-border-medium text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all resize-none"
            />
          </div>
        </div>

        {/* ── Editor de ítems ──────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-ui-divide flex items-center justify-between">
            <div>
              <h2 className="text-base text-content">Ítems</h2>
              <p className="text-xs text-content-faint font-accent mt-0.5">
                Mínimo 1 ítem requerido
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                append({
                  productId:     '',
                  productCode:   '',
                  productDesc:   '',
                  quantity:      1,
                  unitCost:      undefined,
                  unitPrice:     undefined,
                  observaciones: undefined,
                })
              }
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white rounded-lg gradient-action hover:opacity-90 transition-opacity"
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
            supplierBrandIds={needsSupplier ? selectedSupplierBrandIds : undefined}
            disabled={needsSupplier && !watch('thirdPartyId')}
            supplierName={tpSelectedName}
          />

          {fields.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-content-muted text-sm">No hay ítems. Agrega el primero.</p>
            </div>
          ) : (
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
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-divide">
                  {fields.map((field, index) => (
                    <ProductRow
                      key={field.id}
                      index={index}
                      docType={docType}
                      onRemove={() => remove(index)}
                      register={register}
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
                {(showCostColumn || showPriceColumn) && fields.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-ui-border bg-surface-raised">
                      <td colSpan={2} />
                      <td className="px-3 py-3 text-right text-xs font-semibold text-content-faint uppercase tracking-wider">
                        Total
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-medium text-content-secondary">
                        {formatCOP(
                          fields.reduce((sum, _, i) => {
                            const qty   = Number(watch(`items.${i}.quantity`) ?? 0)
                            const price = showPriceColumn
                              ? Number(watch(`items.${i}.unitPrice`) ?? 0)
                              : Number(watch(`items.${i}.unitCost`) ?? 0)
                            return sum + qty * price
                          }, 0),
                        )}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* ── Acciones ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(isEditing ? `/documents/${id}` : '/documents')}
            className="px-4 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-xl gradient-action hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Guardar cambios' : `Crear ${nounFor(docType)}`}
          </button>
        </div>
      </form>
    </div>
  )
}
