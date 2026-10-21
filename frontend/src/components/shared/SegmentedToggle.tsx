import { cn } from '@/lib/utils'

interface SegmentedToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  uncheckedLabel: string
  checkedLabel: string
  disabled?: boolean
}

// Toggle de dos opciones tipo "pill" (ej. Activos / Inactivos)
export function SegmentedToggle({
  checked,
  onChange,
  uncheckedLabel,
  checkedLabel,
  disabled = false,
}: SegmentedToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-md bg-surface-raised border-2 border-ui-border-medium',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={cn(
          'px-4 py-1.5 rounded-sm border-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed',
          !checked ? 'selected-ink' : 'border-transparent text-content-muted hover:text-content',
        )}
      >
        {uncheckedLabel}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={cn(
          'px-4 py-1.5 rounded-sm border-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed',
          checked ? 'selected-ink' : 'border-transparent text-content-muted hover:text-content',
        )}
      >
        {checkedLabel}
      </button>
    </div>
  )
}
