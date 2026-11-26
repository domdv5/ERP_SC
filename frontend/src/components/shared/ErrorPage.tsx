import { useNavigate } from 'react-router-dom'
import { findHomePath } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth.store'

interface ErrorPageProps {
  variant: 'not-found' | 'forbidden'
}

const COPY = {
  'not-found': {
    code: '404',
    title: 'Página no encontrada',
    message: 'La dirección que buscas no existe o fue movida.',
  },
  forbidden: {
    code: '403',
    title: 'No tienes acceso',
    message: 'Tu usuario no tiene permiso para ver esta pantalla.',
  },
} as const

function BrokenDocument() {
  return (
    <svg viewBox="0 0 120 120" className="w-32 h-32" fill="none" aria-hidden="true">
      <path
        d="M30 14h40l22 22v70H30z"
        className="fill-surface-raised stroke-content"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M70 14v22h22" className="stroke-content" strokeWidth="3" strokeLinejoin="round" />
      <path
        d="M42 62l10 10m0-10L42 72"
        className="stroke-content"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M68 62l10 10m0-10L68 72"
        className="stroke-content"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M44 92c4-5 8-5 12 0s8 5 12 0 8-5 12 0"
        className="stroke-brand-secondary"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Lock() {
  return (
    <svg viewBox="0 0 120 120" className="w-32 h-32" fill="none" aria-hidden="true">
      <path
        d="M40 54V40a20 20 0 0 1 40 0v14"
        className="stroke-content"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect
        x="24"
        y="54"
        width="72"
        height="52"
        className="fill-surface-raised stroke-content"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="76" r="6" className="fill-brand-secondary" />
      <path d="M60 80v12" className="stroke-content" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function ErrorPage({ variant }: ErrorPageProps) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { code, title, message } = COPY[variant]

  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-16 min-h-[70vh]">
      <div className="card-hard flex items-center justify-center w-44 h-44 mb-6">
        {variant === 'not-found' ? <BrokenDocument /> : <Lock />}
      </div>
      <p className="font-display text-7xl text-content leading-none">{code}</p>
      <h1 className="text-2xl text-content mt-3">{title}</h1>
      <p className="font-accent text-content-muted mt-2 max-w-sm">{message}</p>
      <button
        type="button"
        onClick={() => navigate(findHomePath(user?.permissions ?? []), { replace: true })}
        className="btn-primary press px-5 py-2.5 mt-6"
      >
        Ir a mi inicio
      </button>
    </div>
  )
}
