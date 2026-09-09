import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface HintTextProps {
  children: ReactNode
  variant?: 'neutral' | 'positive' | 'warning'
}

const VARIANT_CLASSES: Record<NonNullable<HintTextProps['variant']>, string> = {
  neutral: 'text-content-faint',
  positive: 'text-brand-secondary font-medium',
  warning: 'text-amber-500 dark:text-amber-400',
}

// Texto secundario chico para avisos de fila (p. ej. disponibilidad, desviación de costo).
// Va en una fila o celda aparte de los controles principales, nunca en la misma celda que un
// input, para no desalinearlo respecto a los demás inputs de su fila.
export function HintText({ children, variant = 'neutral' }: HintTextProps) {
  return (
    <p className={cn('flex items-center gap-1 text-xs', VARIANT_CLASSES[variant])}>
      {variant === 'warning' && <AlertTriangle className="w-3 h-3 shrink-0" />}
      {children}
    </p>
  )
}
