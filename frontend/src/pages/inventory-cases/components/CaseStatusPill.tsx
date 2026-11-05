import { cn } from '@/lib/utils'
import type { InventoryCaseStatus } from '@/types/inventory-case.types'

const STATUS_PILL: Record<InventoryCaseStatus, { label: string; className: string }> = {
  open: {
    label: 'Abierto',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  },
  closed: {
    label: 'Cerrado',
    className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  },
}

export function CaseStatusPill({ status }: { status: InventoryCaseStatus }) {
  const { label, className } = STATUS_PILL[status]
  return <span className={cn('pill-stamp', className)}>{label}</span>
}
