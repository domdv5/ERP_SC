import { useEffect, type InputHTMLAttributes, type ReactNode } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { X, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getRoles, getRoleLabel } from '@/services/users.service'
import type { AppUser } from '@/services/users.service'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name:            z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  username:        z.string().min(3, 'Mínimo 3 caracteres').max(50, 'Máximo 50 caracteres'),
  password:        z.string().min(6, 'Mínimo 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma la contraseña'),
  roleIds:         z.array(z.string()).min(1, 'Selecciona al menos un rol'),
  active:          z.boolean().optional(),
}).superRefine((val, ctx) => {
  if (val.password !== val.confirmPassword) {
    ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Las contraseñas no coinciden' })
  }
})

const editSchema = z.object({
  name:            z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  username:        z.string().min(3, 'Mínimo 3 caracteres').max(50, 'Máximo 50 caracteres'),
  password:        z.string().min(6, 'Mínimo 6 caracteres').optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
  roleIds:         z.array(z.string()).min(1, 'Selecciona al menos un rol'),
  active:          z.boolean().optional(),
}).superRefine((val, ctx) => {
  if (val.password && val.password !== val.confirmPassword) {
    ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Las contraseñas no coinciden' })
  }
})

export type CreateUserFormValues = z.infer<typeof createSchema>
export type EditUserFormValues   = z.infer<typeof editSchema>
export type UserFormValues       = CreateUserFormValues | EditUserFormValues

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UserFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: UserFormValues) => void
  isPending: boolean
  defaultValues?: AppUser
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserForm({ open, onClose, onSubmit, isPending, defaultValues }: UserFormProps) {
  const isEdit = !!defaultValues
  const [showPassword, setShowPassword]        = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const { data: roles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  const schema = isEdit ? editSchema : createSchema

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      name:     '',
      username: '',
      password: '',
      roleIds:  [],
      active:   true,
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        name:            defaultValues?.name     ?? '',
        username:        defaultValues?.username ?? '',
        password:        '',
        confirmPassword: '',
        roleIds:         defaultValues?.userRoles.map((ur) => ur.role.id) ?? [],
        active:          defaultValues?.active   ?? true,
      })
      setShowPassword(false)
    }
  }, [open, defaultValues, reset])

  if (!open) return null

  const handleFormSubmit = (data: UserFormValues) => {
    // Strip confirmPassword and empty password before sending to service
    const { confirmPassword: _confirm, ...rest } = data as EditUserFormValues & { confirmPassword?: string }
    void _confirm
    if (isEdit && !rest.password) {
      const { password: _pw, ...withoutPw } = rest
      void _pw
      onSubmit(withoutPw as UserFormValues)
      return
    }
    onSubmit(rest as UserFormValues)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border gradient-dark">
          <div>
            <h2 className="text-white font-semibold">
              {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
            </h2>
            <p className="text-white/50 text-xs mt-0.5 font-accent">
              {isEdit ? 'Modifica la información del usuario' : 'Completa la información del usuario'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body + Footer */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col">
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">

            <Field label="Nombre completo" error={errors.name?.message}>
              <Input
                {...register('name')}
                placeholder="Ej: Juan García"
                autoComplete="off"
                autoFocus
              />
            </Field>

            <Field label="Nombre de usuario" error={errors.username?.message}>
              <Input
                {...register('username')}
                placeholder="Ej: jgarcia"
                autoComplete="off"
              />
            </Field>

            <Field
              label={isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña'}
              error={errors.password?.message}
            >
              <div className="relative">
                <Input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isEdit ? 'Dejar en blanco para no cambiar' : 'Mínimo 6 caracteres'}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-faint hover:text-content-muted transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            <Field
              label={isEdit ? 'Confirmar nueva contraseña' : 'Confirmar contraseña'}
              error={(errors as { confirmPassword?: { message?: string } }).confirmPassword?.message}
            >
              <div className="relative">
                <Input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repite la contraseña"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-faint hover:text-content-muted transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </Field>

            {/* Roles — multi-select checkboxes */}
            <Field label="Roles" error={(errors as { roleIds?: { message?: string } }).roleIds?.message}>
              <div className="space-y-2 mt-1">
                {loadingRoles ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-9 rounded-lg bg-surface-hover animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <Controller
                    control={control}
                    name="roleIds"
                    render={({ field }) => (
                      <>
                        {roles.map((role) => {
                          const checked = (field.value as string[]).includes(role.id)
                          return (
                            <label
                              key={role.id}
                              className="flex items-start gap-3 p-2.5 rounded-lg border border-ui-border hover:bg-surface-raised cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const current = field.value as string[]
                                  field.onChange(
                                    checked
                                      ? current.filter((id) => id !== role.id)
                                      : [...current, role.id],
                                  )
                                }}
                                className="mt-0.5 w-4 h-4 rounded border-ui-border-medium accent-brand-secondary shrink-0"
                              />
                              <p className="text-sm font-medium text-content">{getRoleLabel(role.name)}</p>
                            </label>
                          )
                        })}
                      </>
                    )}
                  />
                )}
              </div>
            </Field>

            {isEdit && (
              <Field label="Estado" error={undefined}>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    {...register('active')}
                    className="w-4 h-4 rounded border-ui-border-medium accent-brand-secondary"
                  />
                  <span className="text-sm text-content-secondary">Activo</span>
                </label>
              </Field>
            )}

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
              {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
