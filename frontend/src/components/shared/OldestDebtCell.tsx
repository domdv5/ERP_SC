import { cn } from '@/lib/utils'
import { formatPaymentDays } from '@/lib/format'

export function OldestDebtCell({ days }: { days: number | null }) {
  if (days === null) return <span className="text-content-faint">—</span>
  return (
    <span
      className={cn(
        'font-medium',
        days > 60
          ? 'text-red-600 dark:text-red-400'
          : days > 30
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-content-secondary',
      )}
    >
      {formatPaymentDays(days)}
    </span>
  )
}
