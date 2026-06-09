import { cn } from '@/lib/utils'

interface TablePaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

export function TablePagination({ page, totalPages, total, onPageChange }: TablePaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce<(number | '...')[]>((acc, n, idx, arr) => {
      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('...')
      acc.push(n)
      return acc
    }, [])

  return (
    <div className="px-5 py-3 border-t border-ui-border flex items-center justify-between">
      <span className="text-xs text-content-faint">
        Página {page} de {totalPages} &mdash; {total} registros
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={page === 1}
          className="px-2 py-1 text-xs rounded-lg text-content-muted hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
        <button onClick={() => onPageChange(page - 1)} disabled={page === 1}
          className="px-2 py-1 text-xs rounded-lg text-content-muted hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹</button>

        {pages.map((n, i) =>
          n === '...' ? (
            <span key={`e-${i}`} className="px-2 py-1 text-xs text-content-faint">…</span>
          ) : (
            <button key={n} onClick={() => onPageChange(n as number)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors',
                page === n ? 'text-white gradient-action' : 'text-content-muted hover:bg-surface-hover',
              )}>
              {n}
            </button>
          )
        )}

        <button onClick={() => onPageChange(page + 1)} disabled={page === totalPages}
          className="px-2 py-1 text-xs rounded-lg text-content-muted hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">›</button>
        <button onClick={() => onPageChange(totalPages)} disabled={page === totalPages}
          className="px-2 py-1 text-xs rounded-lg text-content-muted hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
      </div>
    </div>
  )
}
