import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 gradient-dark">
        <Icon className="w-7 h-7 text-white/60" />
      </div>
      <p className="text-content-muted text-sm font-medium">{title}</p>
      <p className="text-content-faint text-xs mt-1 font-accent">{description}</p>
    </div>
  )
}
