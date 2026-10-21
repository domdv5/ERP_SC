import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-md flex items-center justify-center mb-3 gradient-dark shadow-sm">
        <Icon className="w-7 h-7 text-white/70" />
      </div>
      <p className="text-content-secondary text-sm font-semibold uppercase tracking-wider">
        {title}
      </p>
      <p className="text-content-faint text-xs mt-1 font-accent">{description}</p>
    </div>
  )
}
