import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { useInventoryCaseOpenCount } from '@/hooks/useInventoryCaseOpenCount'

export interface PendingItem {
  id: string
  label: string
  count: number
  to: string
}

interface PendingSources {
  openInventoryCases: number
}

// Para sumar otra fuente de pendientes: agregar su conteo a PendingSources y un push aquí.
export function buildPendingItems({ openInventoryCases }: PendingSources): PendingItem[] {
  const items: PendingItem[] = []
  if (openInventoryCases > 0) {
    items.push({
      id: 'inventory-cases',
      label:
        openInventoryCases === 1
          ? '1 caso de inventario abierto'
          : `${openInventoryCases} casos de inventario abiertos`,
      count: openInventoryCases,
      to: '/inventory-cases',
    })
  }
  return items
}

interface NotificationBellViewProps {
  items: PendingItem[]
  defaultOpen?: boolean
}

export function NotificationBellView({ items, defaultOpen = false }: NotificationBellViewProps) {
  const [open, setOpen] = useState(defaultOpen)
  const containerRef = useRef<HTMLDivElement>(null)
  const total = items.reduce((sum, item) => sum + item.count, 0)

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Pendientes"
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          'relative p-2 border-2 rounded-md transition-colors',
          open
            ? 'text-content bg-surface-hover border-ui-border-medium'
            : 'text-content-muted hover:text-content hover:bg-surface-hover border-transparent hover:border-ui-border-medium',
        )}
      >
        <Bell className="w-5 h-5" />
        {total > 0 && (
          <span
            data-testid="bell-dot"
            className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-brand-secondary text-brand-primary text-[10px] font-black leading-4 text-center tabular-nums"
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-md border-2 border-ui-border-medium shadow-md bg-surface z-50">
          <div className="px-4 py-3 border-b-2 border-ui-border-medium bg-surface-raised">
            <p className="text-sm font-semibold text-content">Pendientes</p>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-5 text-sm text-content-muted text-center">No tienes pendientes</p>
          ) : (
            <ul className="p-1">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-content-secondary hover:text-content hover:bg-surface-raised transition-colors"
                  >
                    <ClipboardCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// Solo se monta con permiso: así useInventoryCaseOpenCount no pide el contador a quien no puede verlo.
function BellWithInventoryCases() {
  const { data: openInventoryCases = 0 } = useInventoryCaseOpenCount()
  return <NotificationBellView items={buildPendingItems({ openInventoryCases })} />
}

export function NotificationBell() {
  const canReadInventoryCases = usePermission('inventory_case.read')
  return canReadInventoryCases ? <BellWithInventoryCases /> : <NotificationBellView items={[]} />
}
