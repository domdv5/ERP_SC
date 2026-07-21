import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  id: string
  label: string
  sublabel?: string
}

interface ComboboxProps {
  value: string
  onChange: (id: string, option: ComboboxOption) => void
  options: ComboboxOption[]
  isLoading?: boolean
  placeholder?: string
  // Controlled search (server-side debounce). If omitted, filters client-side internally.
  searchValue?: string
  onSearchChange?: (v: string) => void
  disabled?: boolean
  error?: string | boolean
}

export function Combobox({
  value,
  onChange,
  options,
  isLoading,
  placeholder = 'Selecciona...',
  searchValue: externalSearch,
  onSearchChange,
  disabled,
  error,
}: ComboboxProps) {
  const [open, setOpen]             = useState(false)
  const [localSearch, setLocalSearch] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const triggerRef  = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isControlled   = externalSearch !== undefined
  const searchValue    = isControlled ? externalSearch : localSearch
  const handleSearch   = (v: string) => isControlled ? onSearchChange?.(v) : setLocalSearch(v)

  const displayedOptions = isControlled
    ? options
    : options.filter(o => !localSearch || o.label.toLowerCase().includes(localSearch.toLowerCase()))

  const selectedLabel = options.find(o => o.id === value)?.label ?? ''

  const updatePosition = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setDropdownStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current  && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleReposition = () => updatePosition()
    window.addEventListener('scroll', handleReposition, { capture: true, passive: true })
    window.addEventListener('resize', handleReposition)
    return () => {
      window.removeEventListener('scroll', handleReposition, { capture: true } as EventListenerOptions)
      window.removeEventListener('resize', handleReposition)
    }
  }, [open])

  return (
    <div ref={triggerRef} className="relative">
      <div
        role="combobox"
        aria-expanded={open}
        onClick={() => { if (!disabled) { updatePosition(); setOpen(o => !o) } }}
        className={cn(
          'flex items-center justify-between px-3 py-2 text-sm rounded-lg border cursor-pointer transition-all',
          'bg-surface-raised border-ui-border-medium text-content',
          'focus-within:ring-2 focus-within:ring-brand-secondary/30 focus-within:border-brand-secondary',
          error    && 'border-red-500',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className={cn('truncate', !selectedLabel && 'text-content-faint')}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-content-faint shrink-0 transition-transform', open && 'rotate-180')} />
      </div>

      {open && !disabled && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', zIndex: 9999, ...dropdownStyle }}
          className="bg-surface border border-ui-border-medium rounded-xl shadow-xl overflow-hidden"
        >
          <div className="p-2 border-b border-ui-divide">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-faint" />
              <input
                autoFocus
                value={searchValue}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-raised border border-ui-border rounded-lg text-content placeholder:text-content-faint focus:outline-none focus:ring-2 focus:ring-brand-secondary/30"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-content-faint" />
              </div>
            )}
            {!isLoading && displayedOptions.length === 0 && (
              <p className="text-xs text-content-faint text-center py-4">
                {isControlled && searchValue.length === 0 ? 'Escribe para buscar...' : 'Sin resultados'}
              </p>
            )}
            {!isLoading && displayedOptions.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { onChange(opt.id, opt); setOpen(false); handleSearch('') }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors hover:bg-surface-hover',
                  value === opt.id && 'bg-brand-secondary/10 text-brand-secondary',
                )}
              >
                <p className="font-medium text-xs text-content">{opt.label}</p>
                {opt.sublabel && <p className="text-xs text-content-faint">{opt.sublabel}</p>}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
