import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { BookOpen, ShoppingCart, Scale, TriangleAlert } from 'lucide-react'
import { getOfficialLedger } from '@/services/official-ledger.service'
import {
  StatsGrid,
  TableToolbar,
  TableSkeleton,
  EmptyState,
  ErrorState,
  TablePagination,
} from '@/components/shared'
import { cn } from '@/lib/utils'

const formatQty = (n: number) => n.toLocaleString('es-CO')

export default function OfficialLedgerPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const [debouncedSearch] = useDebounce(search, 400)

  const [prevFilters, setPrevFilters] = useState({ debouncedSearch, dateFrom, dateTo })
  if (
    prevFilters.debouncedSearch !== debouncedSearch ||
    prevFilters.dateFrom !== dateFrom ||
    prevFilters.dateTo !== dateTo
  ) {
    setPrevFilters({ debouncedSearch, dateFrom, dateTo })
    setPage(1)
  }

  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['official-ledger', debouncedSearch, dateFrom, dateTo, page],
    queryFn: () =>
      getOfficialLedger({
        search: debouncedSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    enabled: !hasInvalidDateRange,
  })

  // keepPreviousData deja la respuesta vieja con la query deshabilitada; con rango inválido se corta a vacío.
  const items = hasInvalidDateRange ? [] : (data?.items ?? [])
  const total = hasInvalidDateRange ? 0 : (data?.meta.total ?? 0)
  const totalPages = hasInvalidDateRange ? 1 : (data?.meta.totalPages ?? 1)
  const totals = hasInvalidDateRange ? undefined : data?.meta.totals

  const statCards = [
    {
      label: 'Compras oficiales (unid.)',
      value: formatQty(totals?.purchased ?? 0),
      icon: ShoppingCart,
      bg: 'bg-brand-secondary/10',
      fg: 'text-brand-secondary',
    },
    {
      label: 'Ventas oficiales (unid.)',
      value: formatQty(totals?.sold ?? 0),
      icon: BookOpen,
      bg: 'bg-brand-primary/10',
      fg: 'text-brand-primary dark:text-content',
    },
    {
      label: 'Saldo oficial (unid.)',
      value: formatQty(totals?.closingBalance ?? 0),
      icon: Scale,
      bg: (totals?.closingBalance ?? 0) < 0 ? 'bg-red-500/10' : 'bg-amber-500/10',
      fg: (totals?.closingBalance ?? 0) < 0 ? 'text-red-500' : 'text-amber-500',
    },
  ]

  const hasActiveFilters = Boolean(debouncedSearch || dateFrom || dateTo)
  const rangeQuery = new URLSearchParams({
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  }).toString()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-content">Libro de control oficial</h1>
      </div>

      <StatsGrid cards={statCards} isLoading={isLoading} />

      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="border-b border-ui-border">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Buscar por código o producto..."
            isLoading={isLoading}
            itemCount={items.length}
            total={total}
            onRefresh={refetch}
          />
          <div className="px-5 py-4 flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-xs text-content-muted">
              Desde
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo || undefined}
                className="text-sm bg-surface-raised border border-ui-border-medium rounded-lg px-3 py-1.5 text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-content-muted">
              Hasta
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
                className="text-sm bg-surface-raised border border-ui-border-medium rounded-lg px-3 py-1.5 text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
              />
            </label>
          </div>
        </div>

        {hasInvalidDateRange && (
          <EmptyState
            icon={BookOpen}
            title="Rango de fechas inválido"
            description='"Desde" no puede ser posterior a "Hasta"'
          />
        )}

        {!hasInvalidDateRange && isError && (
          <ErrorState message="Error al cargar el libro oficial" onRetry={refetch} />
        )}

        {!hasInvalidDateRange && isLoading && (
          <TableSkeleton rows={6} widths={['w-40', 'w-28', 'w-24', 'w-20']} />
        )}

        {!hasInvalidDateRange && !isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title={
              hasActiveFilters
                ? 'Sin resultados para estos filtros'
                : 'El libro oficial no tiene movimientos'
            }
            description={
              hasActiveFilters
                ? 'Prueba con otro producto o rango de fechas'
                : 'Los productos aparecen al confirmar compras oficiales o ventas oficiales'
            }
          />
        )}

        {!hasInvalidDateRange && !isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Código', 'Producto', 'Saldo inicial', 'Compras', 'Ventas', 'Saldo'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {items.map((item) => {
                  const isNegative = item.closingBalance < 0
                  return (
                    <tr
                      key={item.productId}
                      onClick={() =>
                        navigate(
                          `/official-ledger/products/${item.productId}${rangeQuery ? `?${rangeQuery}` : ''}`,
                        )
                      }
                      className={cn(
                        'transition-colors cursor-pointer',
                        isNegative ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-surface-raised',
                      )}
                    >
                      <td className="px-5 py-3.5 font-mono text-xs font-medium text-content whitespace-nowrap">
                        {item.code}
                      </td>
                      <td className="px-5 py-3.5 text-content max-w-[320px]">
                        <span className="truncate block">{item.name}</span>
                      </td>
                      <td className="px-5 py-3.5 text-content-muted text-xs">
                        {formatQty(item.openingBalance)}
                      </td>
                      <td className="px-5 py-3.5 text-content-secondary text-xs">
                        {formatQty(item.purchased)}
                      </td>
                      <td className="px-5 py-3.5 text-content-secondary text-xs">
                        {formatQty(item.sold)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-sm font-medium',
                            isNegative ? 'text-red-600 dark:text-red-400' : 'text-content',
                          )}
                        >
                          {isNegative && <TriangleAlert className="w-3.5 h-3.5" />}
                          {formatQty(item.closingBalance)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isError && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  )
}
