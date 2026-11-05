import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/inventory-cases', label: 'Casos', end: true },
  { to: '/inventory-cases/report', label: 'Informe de causas', end: true },
]

export function InventoryCasesTabs() {
  return (
    <nav aria-label="Secciones" className="flex gap-1 border-b-2 border-ui-border-medium">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              'px-4 py-2 -mb-0.5 text-sm font-semibold border-b-2 transition-colors',
              isActive
                ? 'border-brand-secondary text-content'
                : 'border-transparent text-content-muted hover:text-content',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
