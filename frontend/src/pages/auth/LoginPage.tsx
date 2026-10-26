import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import { login } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useThemeStore } from '@/stores/theme.store'

const schema = z.object({
  username: z.string().min(1, 'El usuario es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

type LoginForm = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const theme = useThemeStore((s) => s.theme)

  // El login vive fuera de AppLayout, que es quien aplica el tema al resto de la app
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (data: LoginForm) => login(data.username, data.password),
    onSuccess: ({ user, token }) => {
      setAuth(user, token)
      toast.success(`Bienvenido, ${user.name}`)
      navigate('/dashboard')
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      // Un 401 con otro texto es el usuario desactivado; el resto mantiene el mensaje genérico.
      toast.error(
        status === 401 && msg && msg !== 'Credenciales inválidas'
          ? msg
          : 'Usuario o contraseña incorrectos',
      )
    },
  })

  return (
    <div className="min-h-screen flex bg-page">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden bg-brand-primary">
        {/* Decorative circles */}
        <div className="absolute -top-16 -left-16 w-72 h-72 border-2 border-brand-secondary/20 rotate-12" />
        <div className="absolute -bottom-20 -right-12 w-64 h-64 border-2 border-brand-secondary/20 -rotate-6" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-brand-secondary/10 rotate-45" />

        <div className="relative flex items-center gap-3">
          <img
            src="/Logo.svg"
            alt="EloSC"
            className="w-10 h-10 object-cover border-2 border-white/30 shrink-0"
          />
          <span className="text-white font-bold text-xl tracking-wide">EloSC</span>
        </div>

        <div className="relative">
          <h1 className="text-5xl text-white leading-tight mb-4">
            Gestión inteligente
            <br />
            <span className="text-gradient-brand">de tu cadena</span>
          </h1>
          <p className="text-white/50 text-lg font-accent">
            Inventario, documentos, clientes y más desde una sola plataforma.
          </p>
        </div>

        <p className="relative text-white/20 text-sm">© 2026 EloSC</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="glass rounded-2xl p-8">
            <div className="mb-8">
              <h2 className="text-2xl text-content mb-1">Iniciar sesión</h2>
              <p className="text-content-muted text-sm font-accent">
                Ingresa tus credenciales para continuar
              </p>
            </div>

            <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-5">
              <div>
                <label className="block text-content-secondary text-sm font-medium mb-1.5">
                  Usuario
                </label>
                <input
                  {...register('username')}
                  type="text"
                  placeholder="usuario"
                  className="input-hard w-full px-4 py-3 text-sm placeholder:text-content-faint"
                />
                {errors.username && (
                  <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="block text-content-secondary text-sm font-medium mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input-hard w-full px-4 py-3 pr-11 text-sm placeholder:text-content-faint"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-content-faint hover:text-content transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="btn-primary w-full py-3 text-sm mt-2"
              >
                {isPending ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
