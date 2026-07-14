import {
  useEffect,
  useState,
  useRef,
  useMemo,
  type ReactNode,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Combobox } from '@/components/shared'
import { getBrands, getGenders, getCategories } from '@/services/products.service'
import type { Product } from '@/types'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z
  .object({
    code: z.string().min(1, 'Requerido').max(15, 'Máximo 15 caracteres'),
    legacyCode: z.string().max(15, 'Máximo 15 caracteres').optional().or(z.literal('')),
    description: z.string().min(1, 'Requerido').max(300, 'Máximo 300 caracteres'),
    brandId: z.string().min(1, 'Selecciona una marca'),
    genderId: z.string().min(1, 'Selecciona un género'),
    categoryId: z.string().min(1, 'Selecciona una categoría'),
    salePrice: z.coerce.number().int('Debe ser un número entero').positive('Debe ser positivo'),
    minSalePrice: z.coerce.number().int('Debe ser un número entero').min(0, 'No puede ser negativo'),
    unitOfMeasure: z.enum(['unidad', 'docena']),
  })
  .refine((d) => d.minSalePrice <= d.salePrice, {
    message: 'El precio mínimo no puede superar el precio de venta',
    path: ['minSalePrice'],
  })

export type FormValues = z.infer<typeof schema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProductFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: FormValues) => void
  isPending: boolean
  defaultValues?: Product
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full px-3 py-2 text-sm border border-ui-border-medium rounded-lg bg-surface text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all',
        className,
      )}
      {...props}
    />
  )
}

function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full px-3 py-2 text-sm border border-ui-border-medium rounded-lg bg-surface text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all disabled:opacity-60 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductForm({ open, onClose, onSubmit, isPending, defaultValues }: ProductFormProps) {
  const isEdit = !!defaultValues

  const [suffix, setSuffix] = useState('')
  // Stores the original code when the form opens in edit mode — used to auto-fill legacyCode
  const originalCodeRef = useRef('')
  // Once the user edits minSalePrice by hand, stop overwriting it from salePrice
  const [minSalePriceTouched, setMinSalePriceTouched] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      code: '',
      legacyCode: '',
      description: '',
      brandId: '',
      genderId: '',
      categoryId: '',
      salePrice: 0,
      minSalePrice: 0,
      unitOfMeasure: 'unidad',
    },
  })

  useEffect(() => {
    if (open) {
      originalCodeRef.current = defaultValues?.code ?? ''
      reset({
        code:         defaultValues?.code         ?? '',
        legacyCode:   defaultValues?.legacyCode   ?? '',
        description:  defaultValues?.description  ?? '',
        brandId:      defaultValues?.brandId      ?? '',
        genderId:     defaultValues?.genderId      ?? '',
        categoryId:   defaultValues?.categoryId   ?? '',
        salePrice:    defaultValues?.salePrice    ?? 0,
        minSalePrice: defaultValues?.minSalePrice ?? 0,
        unitOfMeasure: defaultValues?.unitOfMeasure ?? 'unidad',
      })
      setSuffix('')
      setMinSalePriceTouched(false)
    }
  }, [open, defaultValues, reset])

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: getBrands,
    staleTime: Infinity,
  })
  const { data: genders = [] } = useQuery({
    queryKey: ['genders'],
    queryFn: getGenders,
    staleTime: Infinity,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: Infinity,
  })

  const genderIdVal   = useWatch({ control, name: 'genderId' })
  const brandIdVal    = useWatch({ control, name: 'brandId' })
  const categoryIdVal = useWatch({ control, name: 'categoryId' })
  const salePriceVal  = useWatch({ control, name: 'salePrice' })

  const prefix = useMemo(() => {
    const g = genders.find((x) => x.id === genderIdVal)
    const b = brands.find((x) => x.id === brandIdVal)
    const c = categories.find((x) => x.id === categoryIdVal)
    if (!g || !b?.supplier || !c) return ''
    return `${g.code}${String(b.supplier.internalNumber).padStart(3, '0')}${c.code}`
  }, [genderIdVal, brandIdVal, categoryIdVal, genders, brands, categories])

  // Sync `code` field on every change (create mode) or when suffix is typed (edit mode)
  useEffect(() => {
    if (!isEdit) {
      setValue('code', prefix + suffix.toUpperCase())
    } else if (suffix) {
      // New suffix typed → update code and preserve original as legacyCode
      setValue('code', prefix + suffix.toUpperCase())
      if (originalCodeRef.current) setValue('legacyCode', originalCodeRef.current)
    } else {
      // Suffix cleared → revert to original code
      setValue('code', originalCodeRef.current)
      setValue('legacyCode', defaultValues?.legacyCode ?? '')
    }
  }, [prefix, suffix, isEdit, setValue, defaultValues?.legacyCode])

  // Auto-fill minSalePrice as salePrice - 2% while creating, until the user edits it by hand
  useEffect(() => {
    if (isEdit || minSalePriceTouched) return
    const salePrice = Number(salePriceVal) || 0
    setValue('minSalePrice', salePrice > 0 ? Math.round(salePrice * 0.98) : 0)
  }, [salePriceVal, isEdit, minSalePriceTouched, setValue])

  if (!open) return null

  const newCode    = prefix + suffix.toUpperCase()
  const codeChanged = isEdit && suffix !== '' && newCode !== originalCodeRef.current

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border gradient-dark">
          <div>
            <h2 className="text-white font-semibold">
              {isEdit ? 'Editar producto' : 'Nuevo producto'}
            </h2>
            <p className="text-white/50 text-xs mt-0.5 font-accent">
              Completa la información del producto
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body + Footer */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* ── Identificación ── */}
            <section>
              <p className="text-xs font-semibold text-content-faint uppercase tracking-wider mb-3">
                Identificación
              </p>
              <div className="space-y-4">

                {/* Código + Código legado (solo en edición) */}
                <div className={cn('grid gap-4', isEdit ? 'grid-cols-2' : 'grid-cols-1')}>
                  <Field label="Código" error={errors.code?.message}>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        {/* Prefijo auto-calculado */}
                        <div className="px-3 py-2 text-sm bg-surface-hover border border-ui-border rounded-lg text-content-muted font-mono min-w-[90px] text-center shrink-0">
                          {prefix || <span className="text-content-faint text-xs">—</span>}
                        </div>
                        {/* Sufijo editable */}
                        <Input
                          value={suffix}
                          onChange={(e) => setSuffix(e.target.value.replace(/\D/g, ''))}
                          placeholder={isEdit ? 'Nuevo sufijo' : '045'}
                          inputMode="numeric"
                          maxLength={4}
                          autoComplete="off"
                          className="font-mono"
                        />
                      </div>
                      {/* Preview */}
                      {isEdit && !suffix && (
                        <p className="text-xs text-content-faint font-mono">
                          Actual: <span className="text-content-secondary">{originalCodeRef.current}</span>
                        </p>
                      )}
                      {prefix && suffix && (
                        <p className="text-xs font-mono text-content-faint">
                          {codeChanged && (
                            <span className="text-amber-500 dark:text-amber-400">
                              Anterior: {originalCodeRef.current} &middot;{' '}
                            </span>
                          )}
                          Final: <span className="text-content-secondary">{newCode}</span>
                        </p>
                      )}
                    </div>
                  </Field>

                  {/* Código legado — solo en edición */}
                  {isEdit && (
                    <Field label="Código legado" error={errors.legacyCode?.message}>
                      <Input
                        {...register('legacyCode')}
                        placeholder="—"
                        autoComplete="off"
                        className="font-mono"
                      />
                    </Field>
                  )}
                </div>

                <Field label="Descripción" error={errors.description?.message}>
                  <Input
                    {...register('description')}
                    placeholder="Nombre completo del producto"
                    autoComplete="off"
                  />
                </Field>
              </div>
            </section>

            {/* ── Clasificación ── */}
            <section>
              <p className="text-xs font-semibold text-content-faint uppercase tracking-wider mb-3">
                Clasificación
                {isEdit && (
                  <span className="ml-2 normal-case font-normal text-content-faint">
                    (bloqueada en edición)
                  </span>
                )}
              </p>
              <div className="grid grid-cols-4 gap-4">
                <Field label="Marca" error={errors.brandId?.message}>
                  <Controller
                    control={control}
                    name="brandId"
                    render={({ field }) => (
                      <Combobox
                        value={field.value}
                        onChange={(id) => field.onChange(id)}
                        options={brands.map((b) => ({ id: b.id, label: b.name }))}
                        placeholder="Buscar marca..."
                        error={!!errors.brandId}
                        disabled={isEdit}
                      />
                    )}
                  />
                </Field>
                <Field label="Género" error={errors.genderId?.message}>
                  <Select {...register('genderId')} disabled={isEdit}>
                    <option value="">Selecciona...</option>
                    {genders.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Categoría" error={errors.categoryId?.message}>
                  <Select {...register('categoryId')} disabled={isEdit}>
                    <option value="">Selecciona...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Unidad de medida" error={errors.unitOfMeasure?.message}>
                  <Select {...register('unitOfMeasure')}>
                    <option value="unidad">Unidad</option>
                    <option value="docena">Docena</option>
                  </Select>
                </Field>
              </div>
            </section>

            {/* ── Precios ── */}
            <section>
              <p className="text-xs font-semibold text-content-faint uppercase tracking-wider mb-3">
                Precios
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Precio de venta" error={errors.salePrice?.message}>
                  <Input {...register('salePrice')} type="number" min={0} step={1} placeholder="0" />
                </Field>
                <Field label="Precio mínimo de venta" error={errors.minSalePrice?.message}>
                  <Input
                    {...register('minSalePrice', { onChange: () => setMinSalePriceTouched(true) })}
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                  />
                </Field>
              </div>
            </section>

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-ui-border flex justify-end gap-3 bg-surface-raised">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-content-secondary bg-surface border border-ui-border-medium rounded-lg hover:bg-surface-raised transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-all hover:opacity-90 disabled:opacity-50 gradient-action"
            >
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
