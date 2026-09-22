import { cn } from '@/lib/utils'
import type { AccountsReceivableStatus } from '@/types'
import { STATUS_LABELS } from '@/pages/accounts-receivable/accounts-receivable.utils'

interface StatusBadgeProps {
  status: AccountsReceivableStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const info = STATUS_LABELS[status] ?? {
    label: status,
    className: 'bg-content-faint/10 text-content-faint',
  }
  return (
    <span
      className={cn(
        'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
        info.className,
      )}
    >
      {info.label}
    </span>
  )
}
