import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KebabMenuProps {
  onEdit: () => void
}

export function KebabMenu({ onEdit }: KebabMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'p-1.5 rounded-lg transition-colors shrink-0',
          open
            ? 'bg-surface-hover text-content'
            : 'text-content-faint hover:text-content-secondary hover:bg-surface-hover',
        )}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 rounded-xl shadow-2xl py-1 min-w-[140px] border border-ui-border bg-surface">
          <button
            type="button"
            onClick={() => { onEdit(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-content-secondary hover:bg-surface-hover hover:text-content transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 shrink-0" />
            Editar
          </button>
        </div>
      )}
    </div>
  )
}
