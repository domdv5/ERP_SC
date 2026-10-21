import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/shared'
import { cn } from '@/lib/utils'

interface ReportCardProps {
  title: string
  // La pregunta de negocio que responde el gráfico.
  subtitle: string
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  isEmpty: boolean
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  // Datos viejos mostrados mientras llegan los nuevos (keepPreviousData).
  isRefreshing?: boolean
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function ReportCard({
  title,
  subtitle,
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  isRefreshing = false,
  actions,
  className,
  children,
}: ReportCardProps) {
  return (
    <section
      aria-busy={isLoading || isRefreshing}
      className={cn('card-hard p-5 flex flex-col', className)}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-content text-base">{title}</h3>
          <p className="text-content-muted text-xs mt-0.5 font-accent">{subtitle}</p>
        </div>
        {actions}
      </header>

      {isLoading ? (
        <div className="space-y-3 animate-pulse" role="status" aria-label="Cargando gráfico">
          <div className="h-4 w-1/3 rounded bg-surface-hover" />
          <div className="h-56 rounded-xl bg-surface-hover" />
        </div>
      ) : isError ? (
        <ErrorState message="No se pudo cargar este informe" onRetry={onRetry} />
      ) : isEmpty ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className={cn('transition-opacity', isRefreshing && 'opacity-60')}>{children}</div>
      )}
    </section>
  )
}
