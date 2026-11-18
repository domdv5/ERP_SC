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
      className="inline-flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </Link>
  )
}
