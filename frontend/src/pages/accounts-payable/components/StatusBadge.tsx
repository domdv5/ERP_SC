import { cn } from '@/lib/utils'
import type { AccountsPayableStatus } from '@/types'
import { STATUS_LABELS } from '@/pages/accounts-payable/accounts-payable.utils'

interface StatusBadgeProps {
  status: AccountsPayableStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const info = STATUS_LABELS[status]
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap', info.className)}>
      {info.label}
    </span>
  )
}
