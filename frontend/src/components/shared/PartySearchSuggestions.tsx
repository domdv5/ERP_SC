import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { getThirdParties } from '@/services/third-parties.service'
import { cn } from '@/lib/utils'
import type { ThirdPartyDetail } from '@/types/third-party.types'

export interface PickedParty {
  id: string
  name: string
}

interface PartySearchSuggestionsProps {
  role: 'supplier' | 'customer'
  search: string
  debouncedSearch: string
  picked: PickedParty | null
  onPick: (party: PickedParty) => void
  onClear: () => void
  // El TableToolbar: el input de búsqueda es el suyo, aquí solo se le cuelgan las sugerencias
  children: ReactNode
}

// Línea 2 de la sugerencia: lo que coincidió además del nombre (marca activa o NIT)
function getMatchLine(party: ThirdPartyDetail, term: string, role: 'supplier' | 'customer') {
  const needle = term.trim().toLowerCase()
  if (role === 'supplier') {
    const brand = party.supplier?.brands.find(
      (b) => b.active && b.name.toLowerCase().includes(needle),
    )
    if (brand) return `Marca: ${brand.name}`
  }
  if (party.documentNumber.toLowerCase().includes(needle)) return `NIT: ${party.documentNumber}`
  return null
}

export function PartySearchSuggestions({
  role,
  search,
  debouncedSearch,
  picked,
  onPick,
  onClear,
  children,
}: PartySearchSuggestionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data } = useQuery({
    queryKey: ['third-parties-suggestions', role, debouncedSearch],
    queryFn: () =>
      getThirdParties({
        search: debouncedSearch,
        limit: 8,
        ...(role === 'supplier' ? { isSupplier: true } : { isCustomer: true }),
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !picked && debouncedSearch.length >= 1,
  })

  // search vacío corta aunque el debounce aún no lo haya alcanzado
  const suggestions = !picked && search.length >= 1 ? (data?.items ?? []) : []
  const showPanel = isOpen && suggestions.length > 0

  const handlePick = (party: ThirdPartyDetail) => {
    setIsOpen(false)
    setActiveIndex(-1)
    onPick({ id: party.id, name: party.name })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      return
    }
    if (!showPanel) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handlePick(suggestions[activeIndex])
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onInput={() => {
        setIsOpen(true)
        setActiveIndex(-1)
      }}
      onKeyDown={handleKeyDown}
    >
      {children}

      {picked && (
        <div className="pointer-events-none absolute inset-y-0 left-5 w-[calc(100%-2.5rem)] max-w-xs flex items-center justify-end pr-2">
          <button
            type="button"
            onClick={onClear}
            aria-label="Quitar filtro"
            title="Quitar filtro"
            className="pointer-events-auto p-1 rounded text-content-secondary hover:text-content hover:bg-surface-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showPanel && (
        <ul
          role="listbox"
          className="absolute left-5 top-[calc(100%-0.5rem)] z-20 w-[calc(100%-2.5rem)] max-w-xs bg-surface border-2 border-ui-border-medium rounded-md shadow-md overflow-hidden"
        >
          {suggestions.map((party, index) => {
            const matchLine = getMatchLine(party, debouncedSearch, role)
            return (
              <li key={party.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onClick={() => handlePick(party)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'w-full text-left px-3 py-2 transition-colors hover:bg-surface-hover',
                    index === activeIndex && 'bg-surface-hover',
                  )}
                >
                  <span className="block text-sm font-medium text-content truncate">
                    {party.name}
                  </span>
                  {matchLine && (
                    <span className="block text-xs text-content-secondary truncate">
                      {matchLine}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
