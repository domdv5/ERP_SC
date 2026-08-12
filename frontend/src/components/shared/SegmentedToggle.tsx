import { cn } from '@/lib/utils'

interface SegmentedToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  uncheckedLabel: string
  checkedLabel: string
}

/**
 * Toggle de dos opciones tipo "pill" (ej. Activos / Inactivos).
 * `checked` controla cuál de las dos opciones está seleccionada.
 */
export function SegmentedToggle({ checked, onChange, uncheckedLabel, checkedLabel }: SegmentedToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface-raised border border-ui-border">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          !checked ? 'text-white shadow-sm gradient-action' : 'text-content-muted hover:text-content'
        )}
      >
        {uncheckedLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          checked ? 'text-white shadow-sm gradient-action' : 'text-content-muted hover:text-content'
        )}
      >
        {checkedLabel}
      </button>
    </div>
  )
}
