import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { changePassword } from '@/services/auth.service'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
    newPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

interface ChangePasswordDialogProps {
  open: boolean
  onClose: () => void
}

const FIELDS: ReadonlyArray<{ name: keyof FormValues; label: string; autoComplete: string }> = [
  { name: 'currentPassword', label: 'Contraseña actual', autoComplete: 'current-password' },
  { name: 'newPassword', label: 'Nueva contraseña', autoComplete: 'new-password' },
  { name: 'confirmPassword', label: 'Confirmar nueva contraseña', autoComplete: 'new-password' },
]

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      toast.success('Contraseña actualizada')
      handleClose()
    },
    onError: (err) => {
      const raw = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
        ?.message
      const msg = Array.isArray(raw) ? raw[0] : raw
      if (msg === 'La contraseña actual no es correcta.') {
        setError('currentPassword', { message: msg })
        return
      }
      toast.error(msg ?? 'Error al cambiar la contraseña')
    },
  })

  function handleClose() {
    reset()
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="relative bg-surface border-2 border-ui-border-medium rounded-md shadow-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-md border-2 border-ui-border-medium bg-surface-raised flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5 text-content-secondary" />
          </div>
          <h3 className="font-semibold text-content">Cambiar contraseña</h3>
        </div>

        <div className="space-y-4">
          {FIELDS.map(({ name, label, autoComplete }) => (
            <div key={name}>
              <label
                htmlFor={name}
                className="block text-sm font-medium text-content-secondary mb-1"
              >
                {label}
              </label>
              <input
                id={name}
                type="password"
                autoComplete={autoComplete}
                aria-invalid={errors[name] ? 'true' : undefined}
                className="input-hard w-full px-3 py-2 text-sm"
                {...register(name)}
              />
              {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name].message}</p>}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={handleClose} className="btn-secondary px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary px-4 py-2 text-sm"
          >
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
