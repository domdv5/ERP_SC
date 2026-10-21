import { Search, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TableToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  placeholder?: string
  isLoading: boolean
  itemCount: number
  total: number
  onRefresh: () => void
}

export function TableToolbar({
  search,
  onSearchChange,
  placeholder,
  isLoading,
  itemCount,
  total,
  onRefresh,
}: TableToolbarProps) {
  return (
    <div className="px-5 py-4 border-b-2 border-ui-border-medium flex items-center gap-3">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2 text-sm placeholder:text-content-faint border-2 border-ui-border-medium rounded-md bg-surface-raised text-content focus:outline-none focus:border-brand-secondary focus:ring-1 focus:ring-brand-secondary"
        />
      </div>
      <span className="font-mono text-xs text-content-muted ml-auto">
        {isLoading ? '...' : `${itemCount} de ${total} registros`}
      </span>
      <button
        onClick={onRefresh}
        className="p-2 rounded-md border-2 border-transparent text-content-muted hover:text-content hover:bg-surface-hover hover:border-ui-border-medium transition-colors"
        title="Recargar"
      >
        <div className={cn(isLoading && 'animate-spin')}>
          <RefreshCw className="w-4 h-4" />
        </div>
      </button>
    </div>
  )
}
