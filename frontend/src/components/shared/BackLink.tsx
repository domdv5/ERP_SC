import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

type BackLinkProps = { to: string; onBack?: never } | { onBack: () => void; to?: never }

const className = 'btn-secondary inline-flex items-stretch overflow-hidden text-sm p-0'

const content = (
  <>
    <span className="flex items-center px-2.5 bg-brand-primary text-brand-secondary">
      <ArrowLeft className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
    </span>
    <span className="px-3.5 py-1.5">Atrás</span>
  </>
)

export function BackLink(props: BackLinkProps) {
  if (props.onBack) {
    return (
      <button type="button" onClick={props.onBack} className={className}>
        {content}
      </button>
    )
  }
  return (
    <Link to={props.to} className={className}>
      {content}
    </Link>
  )
}
