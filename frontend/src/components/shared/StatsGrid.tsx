import type { LucideIcon } from 'lucide-react'

export interface StatCard {
  label: string
  value: number
  icon: LucideIcon
  bg: string
  fg: string
}

interface StatsGridProps {
  cards: StatCard[]
  isLoading: boolean
}

export function StatsGrid({ cards, isLoading }: StatsGridProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map(({ label, value, icon: Icon, bg, fg }) => (
        <div key={label} className="bg-surface rounded-2xl p-4 border border-ui-border shadow-sm flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
            <Icon className={`w-5 h-5 ${fg}`} />
          </div>
          <div>
            <p className="text-2xl text-content">{isLoading ? '—' : value}</p>
            <p className="text-xs text-content-muted">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
