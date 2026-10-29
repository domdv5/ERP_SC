import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Flechas con borde visible: antes eran texto gris claro y casi no se veían.
const ARROW_BUTTON =
  'p-1.5 rounded-md border-2 border-ui-border-medium text-content-secondary hover:bg-surface-hover hover:text-content disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors'

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
export const DEFAULT_PAGE_SIZE = 10

interface TablePaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

export function TablePagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
}: TablePaginationProps) {
  // Con 0 registros no hay nada que paginar; con 1 sola página se mantiene el selector para poder volver a un tamaño menor.
  if (total === 0) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce<(number | '...')[]>((acc, n, idx, arr) => {
      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('...')
      acc.push(n)
      return acc
    }, [])

  return (
    <div className="px-5 py-3 border-t-2 border-ui-border-medium flex items-center justify-between">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-mono text-xs text-content-muted">
          Página {page} de {totalPages} &mdash; {total} registros
        </span>
        <label className="flex items-center gap-2 font-mono text-xs text-content-muted">
          Mostrar
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="input-hard text-xs border-ui-border-medium px-2 py-1 text-content transition-all"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          por página
        </label>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            className={ARROW_BUTTON}
            aria-label="Primera página"
            title="Primera página"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={ARROW_BUTTON}
            aria-label="Página anterior"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {pages.map((n, i) =>
            n === '...' ? (
              <span key={`e-${i}`} className="px-2 py-1 text-xs text-content-faint">
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => onPageChange(n as number)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-md border-2 font-semibold transition-colors',
                  page === n
                    ? 'selected-ink shadow-xs press press-sm'
                    : 'border-transparent text-content-muted hover:bg-surface-hover hover:border-ui-border-medium',
                )}
              >
                {n}
              </button>
            ),
          )}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className={ARROW_BUTTON}
            aria-label="Página siguiente"
            title="Página siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages}
            className={ARROW_BUTTON}
            aria-label="Última página"
            title="Última página"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
