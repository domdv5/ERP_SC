import { Package } from 'lucide-react'
import { Tooltip } from '@/components/shared'
import { cn } from '@/lib/utils'
import { getAvailableStockHint } from './available-stock'

interface AvailableStockHintProps {
  available: number | null | undefined
  quantity: number
}

// Ícono junto a la cantidad: el color avisa siempre (verde alcanza, ámbar no alcanza) y el número va en el tooltip
export function AvailableStockHint({ available, quantity }: AvailableStockHintProps) {
  const hint = getAvailableStockHint(available, quantity)
  if (!hint) return null
  return (
    <Tooltip content={hint.text} label={hint.text}>
      <Package
        className={cn(
          'w-4 h-4',
          hint.variant === 'warning'
            ? 'text-amber-500 dark:text-amber-400'
            : 'text-emerald-700 dark:text-brand-secondary',
        )}
      />
    </Tooltip>
  )
}
