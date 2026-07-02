import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Plus, Trash2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ThirdParty } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  personType: z.enum(['natural', 'juridica']),
  documentType: z.enum(['CC', 'NIT', 'CE', 'PAS', 'TI', 'RC']),
  documentNumber: z.string().min(1, 'Requerido'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  isSeller: z.boolean().optional(),
  isCustomer: z.boolean().optional(),
  isSupplier: z.boolean().optional(),
  creditLimit: z.coerce.number().optional(),
  discount: z.coerce.number().min(0).max(100).optional(),
  internalNumber: z.coerce.number().int().optional(),
  brands: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  if (data.personType === 'natural') {
    if (!data.firstName?.trim()) ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'Requerido para persona natural' })
    if (!data.lastName?.trim()) ctx.addIssue({ code: 'custom', path: ['lastName'], message: 'Requerido para persona natural' })
  }
  if (data.isSupplier) {
    if (!data.internalNumber) ctx.addIssue({ code: 'custom', path: ['internalNumber'], message: 'Requerido para proveedor' })
    if (!data.brands?.length) ctx.addIssue({ code: 'custom', path: ['brands'], message: 'Agrega al menos una marca' })
  }
})

type FormValues = z.infer<typeof schema>

interface ThirdPartyFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: FormValues) => void
  onRenameBrand?: (brandId: string, newName: string) => Promise<void>
  isPending: boolean
  defaultValues?: ThirdParty
}

const DOCUMENT_TYPES = ['CC', 'NIT', 'CE', 'PAS', 'TI', 'RC'] as const
const DOCUMENT_LABELS: Record<string, string> = {
  CC: 'Cédula de Ciudadanía', NIT: 'NIT', CE: 'Cédula Extranjera',
  PAS: 'Pasaporte', TI: 'Tarjeta de Identidad', RC: 'Registro Civil',
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
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

function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full px-3 py-2 text-sm border border-ui-border-medium rounded-lg bg-surface text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
        checked
          ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondary-dark'
          : 'border-ui-border-medium bg-surface text-content-muted hover:border-ui-border',
      )}
    >
      <span className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
        checked ? 'border-brand-secondary bg-brand-secondary' : 'border-ui-border-medium'
      )}>
        {checked && <span className="text-white text-[10px] leading-none">✓</span>}
      </span>
      {label}
    </button>
  )
}

function flattenDefaults(tp: ThirdParty): Partial<FormValues> {
  return {
    name: tp.name,
    personType: tp.personType,
    documentType: tp.documentType,
    documentNumber: tp.documentNumber,
    firstName: tp.firstName,
    lastName: tp.lastName,
    email: tp.email ?? '',
    phone: tp.phone,
    address: tp.address,
    isSeller: tp.isSeller ?? false,
    isCustomer: tp.customer != null,
    isSupplier: tp.supplier != null,
    creditLimit: tp.customer?.creditLimit,
    discount: tp.customer?.discount,
    internalNumber: tp.supplier?.internalNumber,
    brands: tp.supplier?.brands?.map((b) => b.name) ?? [],
  }
}

export function ThirdPartyForm({ open, onClose, onSubmit, onRenameBrand, isPending, defaultValues }: ThirdPartyFormProps) {
  const [brandInput, setBrandInput] = useState('')
  const [editingBrand, setEditingBrand] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [brandIds, setBrandIds] = useState<Map<string, string>>(
    () => new Map(defaultValues?.supplier?.brands?.map((b) => [b.name, b.id]) ?? [])
  )
  const cancelRenameRef = useRef(false)
  const isEdit = !!defaultValues

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      personType: 'natural',
      documentType: 'CC',
      isCustomer: false,
      isSupplier: false,
      isSeller: false,
      brands: [],
      ...(defaultValues ? flattenDefaults(defaultValues) : {}),
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        personType: 'natural',
        documentType: 'CC',
        isCustomer: false,
        isSupplier: false,
        isSeller: false,
        brands: [],
        ...(defaultValues ? flattenDefaults(defaultValues) : {}),
      })
      setBrandIds(new Map(defaultValues?.supplier?.brands?.map((b) => [b.name, b.id]) ?? []))
      setEditingBrand(null)
    }
  }, [open, defaultValues, reset])

  const personType = watch('personType')
  const isCustomer = watch('isCustomer')
  const isSupplier = watch('isSupplier')
  const brands = watch('brands') ?? []

  function addBrand() {
    const trimmed = brandInput.trim()
    if (!trimmed || brands.includes(trimmed)) return
    setValue('brands', [...brands, trimmed], { shouldValidate: true, shouldDirty: true })
    setBrandInput('')
  }

  function removeBrand(brand: string) {
    if (brandIds.has(brand)) {
      toast.info('Las marcas existentes no se pueden eliminar porque pueden tener productos asignados.')
      return
    }
    setValue('brands', brands.filter((b) => b !== brand), { shouldValidate: true, shouldDirty: true })
  }

  function startRename(brand: string) {
    setEditingBrand(brand)
    setEditingValue(brand)
  }

  // Only brands not already persisted (not in brandIds) should be created on submit.
  // Renamed brands live in brandIds with their new name, so they won't be re-created.
  // Send undefined (not []) when there are no new brands, so the backend skips the
  // brand block entirely — an empty array would trip @ArrayNotEmpty validation.
  const submitForm = (data: FormValues) => {
    const newBrands = (data.brands ?? []).filter((n) => !brandIds.has(n))
    onSubmit({ ...data, brands: newBrands.length ? newBrands : undefined })
  }

  async function confirmRename(oldName: string) {
    setEditingBrand(null)
    if (cancelRenameRef.current) { cancelRenameRef.current = false; return }
    const newName = editingValue.trim()
    if (!newName || newName === oldName) return
    const brandId = brandIds.get(oldName)
    if (brandId && onRenameBrand) {
      await onRenameBrand(brandId, newName)
      setBrandIds((prev) => { const m = new Map(prev); m.delete(oldName); m.set(newName, brandId); return m })
    }
    setValue('brands', brands.map((b) => (b === oldName ? newName : b)), { shouldValidate: true, shouldDirty: true })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border gradient-dark">
          <div>
            <h2 className="text-white font-semibold">{isEdit ? 'Editar tercero' : 'Nuevo tercero'}</h2>
            <p className="text-white/50 text-xs mt-0.5">Completa la información del tercero</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(submitForm as never)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Tipo de persona */}
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">Tipo de persona</label>
              <div className="grid grid-cols-2 gap-2">
                {(['natural', 'juridica'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setValue('personType', type)}
                    className={cn(
                      'py-2.5 rounded-xl text-sm font-medium border transition-all',
                      personType === type
                        ? 'text-white border-transparent shadow-sm gradient-dark'
                        : 'border-ui-border-medium text-content-muted bg-surface hover:border-ui-border',
                    )}
                  >
                    {type === 'natural' ? 'Persona Natural' : 'Persona Jurídica'}
                  </button>
                ))}
              </div>
            </div>

            {/* Campos condicionales por tipo */}
            {personType === 'natural' ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nombres" error={errors.firstName?.message}>
                  <Input {...register('firstName')} placeholder="Ej. Juan Carlos" />
                </Field>
                <Field label="Apellidos" error={errors.lastName?.message}>
                  <Input {...register('lastName')} placeholder="Ej. Pérez Gómez" />
                </Field>
              </div>
            ) : (
              <Field label="Razón social" error={errors.name?.message}>
                <Input {...register('name')} placeholder="Nombre de la empresa" />
              </Field>
            )}

            {personType === 'natural' && (
              <Field label="Nombre completo (display)" error={errors.name?.message}>
                <Input {...register('name')} placeholder="Nombre que aparecerá en el sistema" />
              </Field>
            )}

            {/* Documento */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de documento" error={errors.documentType?.message}>
                <Select {...register('documentType')}>
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt} value={dt}>{DOCUMENT_LABELS[dt]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Número de documento" error={errors.documentNumber?.message}>
                <Input {...register('documentNumber')} placeholder="Ej. 1234567890" />
              </Field>
            </div>

            {/* Contacto */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email" error={errors.email?.message}>
                <Input {...register('email')} type="email" placeholder="correo@ejemplo.com" />
              </Field>
              <Field label="Teléfono" error={errors.phone?.message}>
                <Input {...register('phone')} placeholder="Ej. 3001234567" />
              </Field>
            </div>

            <Field label="Dirección" error={errors.address?.message}>
              <Input {...register('address')} placeholder="Dirección completa" />
            </Field>

            {/* Roles */}
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-2">Roles del tercero</label>
              <div className="flex flex-wrap gap-2">
                <Toggle checked={!!isCustomer} onChange={(v) => setValue('isCustomer', v)} label="Cliente" />
                <Toggle checked={!!isSupplier} onChange={(v) => setValue('isSupplier', v)} label="Proveedor" />
                <Toggle checked={!!watch('isSeller')} onChange={(v) => setValue('isSeller', v)} label="Vendedor" />
              </div>
            </div>

            {/* Campos de cliente */}
            {isCustomer && (
              <div className="p-4 rounded-xl border border-brand-secondary/20 bg-brand-secondary/5 space-y-4">
                <p className="text-sm font-medium text-brand-secondary-dark">Datos de cliente</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Límite de crédito" error={errors.creditLimit?.message}>
                    <Input {...register('creditLimit')} type="number" step="0.01" placeholder="0.00" />
                  </Field>
                  <Field label="Descuento (%)" error={errors.discount?.message}>
                    <Input {...register('discount')} type="number" step="0.01" min="0" max="100" placeholder="0.00" />
                  </Field>
                </div>
              </div>
            )}

            {/* Campos de proveedor */}
            {isSupplier && (
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10 space-y-4">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Datos de proveedor</p>
                <Field label="Número interno" error={errors.internalNumber?.message}>
                  <Input {...register('internalNumber')} type="number" placeholder="Ej. 1001" />
                </Field>
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">Marcas</label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={brandInput}
                      onChange={(e) => setBrandInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBrand() }}}
                      placeholder="Nombre de la marca"
                    />
                    <button type="button" onClick={addBrand}
                      className="px-3 py-2 rounded-lg text-white bg-brand-primary hover:bg-brand-primary-light transition-colors flex items-center gap-1 text-sm shrink-0">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {errors.brands && <p className="text-red-500 text-xs mb-2">{errors.brands.message}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {brands.map((brand) => {
                      const isOriginal = brandIds.has(brand)
                      if (editingBrand === brand) {
                        return (
                          <span key={brand} className="flex items-center gap-1 px-1.5 py-0.5 bg-surface border border-brand-secondary rounded-full">
                            <input
                              autoFocus
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => confirmRename(brand)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
                                if (e.key === 'Escape') { e.preventDefault(); cancelRenameRef.current = true; e.currentTarget.blur() }
                              }}
                              className="text-xs bg-transparent text-content outline-none w-28"
                            />
                          </span>
                        )
                      }
                      return (
                        <span key={brand} className="flex items-center gap-1 px-2.5 py-1 bg-surface border border-ui-border-medium rounded-full text-xs text-content-secondary">
                          <span onDoubleClick={() => startRename(brand)} className="cursor-text select-none" title="Doble clic para editar">{brand}</span>
                          <button type="button" onClick={() => removeBrand(brand)}
                            className={cn('transition-colors', isOriginal ? 'text-content-faint cursor-not-allowed' : 'text-content-faint hover:text-red-500')}
                            title={isOriginal ? 'No se puede eliminar' : 'Eliminar marca'}
                          >
                            {isOriginal ? <Lock className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-ui-border flex justify-end gap-3 bg-surface-raised">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-content-secondary bg-surface border border-ui-border-medium rounded-lg hover:bg-surface-raised transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-all hover:opacity-90 disabled:opacity-50 gradient-action">
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear tercero'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
