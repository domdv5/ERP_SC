import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface BackLinkProps {
  to: string
  label: string
}

export function BackLink({ to, label }: BackLinkProps) {
  return (
    <Link to={to} className="btn-secondary inline-flex items-center gap-2 text-sm px-3 py-1.5">
      <ArrowLeft className="w-4 h-4" />
      {label}
    </Link>
  )
}
