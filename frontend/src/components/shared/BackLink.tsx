import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface BackLinkProps {
  to: string
  label: string
}

export function BackLink({ to, label }: BackLinkProps) {
  return (
    <Link
      to={to}
      aria-label={`Volver a ${label}`}
      className="btn-secondary inline-flex items-stretch overflow-hidden text-sm p-0"
    >
      <span className="flex items-center px-2.5 bg-brand-primary text-brand-secondary">
        <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
      </span>
      <span className="px-3.5 py-1.5">{label}</span>
    </Link>
  )
}
