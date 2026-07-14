import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useDebounce } from 'use-debounce'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'

import { getDocument, createDocument, updateDocument } from '@/services/documents.service'
import { getWarehouses, getWarehouse } from '@/services/warehouses.service'
import { getThirdParties } from '@/services/third-parties.service'
import { useAuthStore } from '@/stores/auth.store'
import { Combobox } from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { cn } from '@/lib/utils'
import { formSchema, type FormValues } from './document-form.schema'
import { ProductRow } from './components/ProductRow'
import { BarcodeScanInput } from './components/BarcodeScanInput'

import type { DocumentType } from '@/types/document.types'
import type { Warehouse, WarehouseDetail } from '@/types/warehouse.types'
import type { ThirdParty } from '@/types/third-party.types'

// ─── constants ───────────────────────────────────────────────────────────────

const formatCOP = (v: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v)

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'CM',  label: 'Compra' },
  { value: 'DVC', label: 'Devolución compra' },
  { value: 'EAI', label: 'Entrada ajuste' },
  { value: 'SAJ', label: 'Salida ajuste' },
  { value: 'T',   label: 'Traslado' },
]

const TODAY = new Date().toISOString().slice(0, 10)

// ─── main page ───────────────────────────────────────────────────────────────

export default function DocumentFormPage() {
  const navigate    = useNavigate()
  const { id }      = useParams<{ id: string }>()
  const isEditing   = Boolean(id)
  const queryClient = useQueryClient()

  const userPermissions = useAuthStore((s) => s.user?.permissions ?? [])
  const availableTypes = DOC_TYPE_OPTIONS.filter((opt) =>
    userPermissions.includes(`document.create.${opt.value}`)
  )

  // Third-party search
  const [tpSearch, setTpSearch] = useState('')
  const [debouncedTpSearch] = useDebounce(tpSearch, 400)
  const [tpSelectedName, setTpSelectedName] = useState('')

  // avgCost + unitOfMeasure por producto conocidos al momento de agregarlo vía escaneo de código
  // de barras — permite que ProductRow inicialice su selectedAvgCost/selectedUnitOfMeasure aunque
  // la fila no se haya creado a través del combobox propio de la fila (ver initialAvgCost /
  // initialUnitOfMeasure en ProductRow).
  const [scannedProductInfo, setScannedProductInfo] = useState<
    Record<string, { avgCost: number; unitOfMeasure: 'unidad' | 'docena' }>
  >({})

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      type:  (availableTypes[0]?.value ?? 'CM') as FormValues['type'],
      date:  TODAY,
      items: [],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })

  const docType         = watch('type')
  const warehouseId     = watch('warehouseId')
  const destWarehouseId = watch('destWarehouseId')

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
    setTpSelectedName(existingDoc.thirdParty?.name ?? '')
    reset({
      type:            existingDoc.type,
      date:            existingDoc.date.slice(0, 10),
      thirdPartyId:    existingDoc.thirdParty?.id ?? undefined,
      warehouseId:     existingDoc.warehouse?.id ?? undefined,
      destWarehouseId: existingDoc.destWarehouse?.id ?? undefined,
      destBinId:       existingDoc.destBin?.id ?? undefined,
      freight:         existingDoc.freight ?? undefined,
      notes:           existingDoc.notes ?? undefined,
      items: existingDoc.documentItems.map((item) => ({
        productId:     item.productId,
        productCode:   item.product.code,
        productDesc:   item.product.description,
        quantity:      item.quantity,
        unitCost:      item.unitCost ?? undefined,
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

  const { data: tpData, isLoading: isLoadingTp } = useQuery({
    queryKey: ['third-parties-search', debouncedTpSearch],
    queryFn: () => getThirdParties({ search: debouncedTpSearch || undefined, page: 1, limit: 30, isSupplier: true }),
    staleTime: 2 * 60 * 1000,
    enabled: docType === 'CM' || docType === 'DVC',
  })

  // Load dest warehouse detail for zone/bin cascade (only for T type)
  const { data: destWarehouseDetail, isLoading: isLoadingDestDetail } = useQuery({
    queryKey: ['warehouse-detail', destWarehouseId],
    queryFn: () => getWarehouse(destWarehouseId!),
    enabled: docType === 'T' && Boolean(destWarehouseId),
    staleTime: 5 * 60 * 1000,
  })

  // When dest warehouse changes, reset destBinId and zone selection
  useEffect(() => {
    setValue('destBinId', undefined)
  }, [destWarehouseId, setValue])

  // Require bin when dest warehouse is of type 'warehouse'
  const destRequiresBin =
    docType === 'T' &&
    Boolean(destWarehouseId) &&
    warehouses.find((w: Warehouse) => w.id === destWarehouseId)?.type === 'warehouse'

  const destZones = (destWarehouseDetail as WarehouseDetail | undefined)?.zones ?? []

  const [selectedZoneId, setSelectedZoneId] = useState('')
  useEffect(() => { setSelectedZoneId('') }, [destWarehouseId])

  const destBins = (selectedZoneId
    ? destZones.find((z) => z.id === selectedZoneId)?.bins ?? []
    : destZones.flatMap((z) => z.bins)
  ).filter((bin) => !bin.occupied)

  // Third-party options
  const tpOptions: ComboboxOption[] = (tpData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
    sublabel: tp.isSupplier ? 'Proveedor' : undefined,
  }))

  const currentTpId = watch('thirdPartyId') ?? ''

  const tpDisplayOptions: ComboboxOption[] = currentTpId && !debouncedTpSearch
    ? [{ id: currentTpId, label: tpSelectedName }, ...tpOptions.filter((o) => o.id !== currentTpId)]
    : tpOptions

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
      warehouseId:     values.type === 'T' ? (values.warehouseId || undefined) : undefined,
      destWarehouseId: values.destWarehouseId || undefined,
      destBinId:       values.destBinId || undefined,
      freight:         values.freight !== undefined && !isNaN(values.freight) ? values.freight : undefined,
      notes:           values.notes || undefined,
      items: values.items.map((item) => ({
        productId:     item.productId,
        quantity:      item.quantity,
        unitCost:      item.unitCost !== undefined && !isNaN(item.unitCost) ? item.unitCost : undefined,
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
  const needsThirdParty = docType === 'CM' || docType === 'DVC'
  const needsTransfer   = docType === 'T'
  const needsFreight    = docType === 'CM'
  const showCostColumn  = docType === 'CM' || docType === 'DVC' || docType === 'EAI'
  // SAJ y T también necesitan la columna de costo (de solo lectura) para que el número de <td> por
  // fila siga alineado con el <thead> — antes la columna quedaba totalmente ausente para ambos.
  const hasCostColumn   = showCostColumn || docType === 'SAJ' || docType === 'T'
  // Nota de talla por línea — solo traslados (T), ver showObservaciones en ProductRow.tsx.
  const showObservacionesColumn = docType === 'T'

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(isEditing ? `/documents/${id}` : '/documents')}
          className="p-2 rounded-xl text-content-faint hover:text-content hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl text-content">
            {isEditing ? 'Editar operación' : 'Nueva operación'}
          </h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">
            {isEditing
              ? 'Editando borrador'
              : 'Crea una nueva operación de inventario'}
          </p>
        </div>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
        {/* ── General info card ─────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6 space-y-5">
          <h2 className="text-base text-content border-b border-ui-divide pb-3">
            Información general
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Type */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-content-secondary">
                Tipo de operación <span className="text-red-500">*</span>
              </label>
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
                      setValue('warehouseId', undefined)
                      setValue('destWarehouseId', undefined)
                      setValue('destBinId', undefined)
                      setValue('freight', undefined)
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
              {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-content-secondary">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...register('date')}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary',
                  errors.date ? 'border-red-500' : 'border-ui-border-medium',
                )}
              />
              {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
            </div>

            {/* Third party (CM / DVC only) */}
            {needsThirdParty && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-content-secondary">
                  Proveedor <span className="text-red-500">*</span>
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
                      }}
                      options={tpDisplayOptions}
                      isLoading={isLoadingTp}
                      placeholder="Selecciona un proveedor..."
                      searchValue={tpSearch}
                      onSearchChange={setTpSearch}
                      error={errors.thirdPartyId?.message}
                    />
                  )}
                />
                {errors.thirdPartyId && (
                  <p className="text-xs text-red-500">{errors.thirdPartyId.message}</p>
                )}
              </div>
            )}

            {/* Transfer: source + dest warehouses */}
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
                        className={cn(
                          'w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all',
                          'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary',
                          errors.warehouseId ? 'border-red-500' : 'border-ui-border-medium',
                        )}
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
                  {errors.warehouseId && (
                    <p className="text-xs text-red-500">{errors.warehouseId.message}</p>
                  )}
                </div>

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
                        className={cn(
                          'w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all',
                          'focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary',
                          errors.destWarehouseId ? 'border-red-500' : 'border-ui-border-medium',
                        )}
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
                  {errors.destWarehouseId && (
                    <p className="text-xs text-red-500">{errors.destWarehouseId.message}</p>
                  )}
                </div>

                {/* Zone + bin cascade when dest is type 'warehouse' */}
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

            {/* Freight (CM only) */}
            {needsFreight && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-content-secondary">
                  Flete
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0"
                  {...register('freight')}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised border-ui-border-medium text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
                />
                {errors.freight && (
                  <p className="text-xs text-red-500">{errors.freight.message}</p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
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

        {/* ── Items editor ──────────────────────────────────────────────── */}
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
            docType={docType}
            append={append}
            getValues={getValues}
            setValue={setValue}
            onProductScanned={(productId, avgCost, unitOfMeasure) =>
              setScannedProductInfo((prev) => ({ ...prev, [productId]: { avgCost, unitOfMeasure } }))
            }
          />

          {typeof errors.items?.message === 'string' && (
            <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20">
              <p className="text-sm text-red-500">{errors.items.message}</p>
            </div>
          )}

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
                        Costo unit.{' '}
                        {docType === 'EAI' && (
                          <span className="text-content-faint normal-case">(opc.)</span>
                        )}
                        {(docType === 'SAJ' || docType === 'T') && (
                          <span className="text-content-faint normal-case">(autom.)</span>
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
                      errors={errors}
                      initialAvgCost={scannedProductInfo[field.productId]?.avgCost}
                      initialUnitOfMeasure={scannedProductInfo[field.productId]?.unitOfMeasure}
                    />
                  ))}
                </tbody>
                {showCostColumn && fields.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-ui-border bg-surface-raised">
                      <td colSpan={2} />
                      <td className="px-3 py-3 text-right text-xs font-semibold text-content-faint uppercase tracking-wider">
                        Total
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-medium text-content-secondary">
                        {formatCOP(
                          fields.reduce((sum, _, i) => {
                            const qty  = Number(watch(`items.${i}.quantity`) ?? 0)
                            const cost = Number(watch(`items.${i}.unitCost`) ?? 0)
                            return sum + qty * cost
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

        {/* ── Actions ───────────────────────────────────────────────────── */}
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
            {isEditing ? 'Guardar cambios' : 'Crear operación'}
          </button>
        </div>
      </form>
    </div>
  )
}
