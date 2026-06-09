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
    <div className="px-5 py-4 border-b border-ui-border flex items-center gap-3">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-2 text-sm bg-surface-raised border border-ui-border-medium rounded-lg text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
        />
      </div>
      <span className="text-xs text-content-faint ml-auto">
        {isLoading ? '...' : `${itemCount} de ${total} registros`}
      </span>
      <button
        onClick={onRefresh}
        className="p-2 rounded-lg text-content-faint hover:text-content-muted hover:bg-surface-hover transition-colors"
        title="Recargar"
      >
        <div className={cn(isLoading && 'animate-spin')}>
          <RefreshCw className="w-4 h-4" />
        </div>
      </button>
    </div>
  )
}
