import type { LucideIcon } from 'lucide-react'

export interface StatCard {
  label: string
  // string admite valores ya formateados (ej. formatCOP) además de conteos crudos
  value: number | string
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
        <div key={label} className="card-hard p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${bg}`}>
            <Icon className={`w-5 h-5 ${fg}`} />
          </div>
          <div>
            <p className="font-display font-black text-3xl leading-none text-content tabular-nums">
              {isLoading ? '—' : value}
            </p>
            <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-content-muted">
              {label}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
