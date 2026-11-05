import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { CheckCircle2, Clock, ClipboardList, Inbox, TriangleAlert } from 'lucide-react'
import { getInventoryCases } from '@/services/inventory-cases.service'
import {
  StatsGrid,
  TableToolbar,
  TableSkeleton,
  EmptyState,
  ErrorState,
  TablePagination,
  DEFAULT_PAGE_SIZE,
} from '@/components/shared'
import { formatBogotaDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { InventoryCaseStatus } from '@/types/inventory-case.types'
import { CaseStatusPill } from './components/CaseStatusPill'
import { DocumentLink } from './components/DocumentLink'
import { InventoryCasesTabs } from './components/InventoryCasesTabs'
import { OVERDUE_DAYS, formatSignedQuantity } from './inventory-cases.constants'
import { useCaseWarehouses } from './useCaseWarehouses'

type StatusFilter = InventoryCaseStatus | 'all'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Abiertos' },
  { value: 'closed', label: 'Cerrados' },
  { value: 'all', label: 'Todos' },
]

const COLUMNS = [
  'N° caso',
  'Fecha ajuste',
  'Código',
  'Producto',
  'Marca',
  'Bodega',
  'Stock sistema',
  'Documento',
  'Ajustó',
  'Fecha cierre',
  'Días abierto',
  'Estado',
]

const FILTER_INPUT_CLASS = 'input-hard text-sm border-ui-border-medium px-3 py-1.5 text-content'

export default function InventoryCasesPage() {
  const navigate = useNavigate()
  const { warehouses } = useCaseWarehouses()

  const [status, setStatus] = useState<StatusFilter>('open')
  const [warehouseId, setWarehouseId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)

  const [debouncedSearch] = useDebounce(search, 400)

  const [prevFilters, setPrevFilters] = useState({
    status,
    warehouseId,
    dateFrom,
    dateTo,
    debouncedSearch,
  })
  if (
    prevFilters.status !== status ||
    prevFilters.warehouseId !== warehouseId ||
    prevFilters.dateFrom !== dateFrom ||
    prevFilters.dateTo !== dateTo ||
    prevFilters.debouncedSearch !== debouncedSearch
  ) {
    setPrevFilters({ status, warehouseId, dateFrom, dateTo, debouncedSearch })
    setPage(1)
  }

  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'inventory-cases',
      'list',
      status,
      warehouseId,
      dateFrom,
      dateTo,
      debouncedSearch,
      page,
      limit,
    ],
    queryFn: () =>
      getInventoryCases({
        status: status === 'all' ? undefined : status,
        warehouseId: warehouseId || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        search: debouncedSearch || undefined,
        page,
        limit,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    enabled: !hasInvalidDateRange,
  })

  // keepPreviousData deja la respuesta vieja con la query deshabilitada; con rango inválido se corta a vacío.
  const items = hasInvalidDateRange ? [] : (data?.items ?? [])
  const total = hasInvalidDateRange ? 0 : (data?.meta.total ?? 0)
  const totalPages = hasInvalidDateRange ? 1 : (data?.meta.totalPages ?? 1)
  const meta = data?.meta

  const statCards = [
    {
      label: 'Casos abiertos',
      value: meta?.openCount ?? 0,
      icon: Inbox,
      bg: 'bg-amber-500/10',
      fg: 'text-amber-500',
    },
    {
      label: 'Cerrados este mes',
      value: meta?.closedThisMonth ?? 0,
      icon: CheckCircle2,
      bg: 'bg-brand-secondary/10',
      fg: 'text-brand-secondary',
    },
    {
      label: 'Días promedio para cerrar',
      value:
        meta?.avgDaysToClose == null
          ? '—'
          : `${meta.avgDaysToClose.toLocaleString('es-CO', { maximumFractionDigits: 1 })} días`,
      icon: Clock,
      bg: 'bg-brand-primary/10',
      fg: 'text-brand-primary dark:text-content',
    },
  ]

  const hasActiveFilters = Boolean(warehouseId || dateFrom || dateTo || debouncedSearch)
  const isFiltered = hasActiveFilters || status !== 'open'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-content">Diferencias de inventario</h1>
        <p className="text-sm text-content-muted font-accent mt-1">
          Cada línea de una EAI por «negativo» abre un caso para encontrar la causa.
        </p>
      </div>

      <InventoryCasesTabs />

      <StatsGrid cards={statCards} isLoading={isLoading} />

      <div className="card-hard overflow-hidden">
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
          <div className="px-5 py-4 flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Estado"
              className="inline-flex items-center gap-1 p-1 rounded-md bg-surface-raised border-2 border-ui-border-medium"
            >
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={status === option.value}
                  onClick={() => setStatus(option.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-sm border-2 text-sm font-semibold transition-colors',
                    status === option.value
                      ? 'selected-ink'
                      : 'border-transparent text-content-muted hover:text-content',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              aria-label="Bodega"
              className={FILTER_INPUT_CLASS}
            >
              <option value="">Todas las bodegas</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-xs text-content-muted">
              Desde
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo || undefined}
                className={FILTER_INPUT_CLASS}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-content-muted">
              Hasta
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
                className={FILTER_INPUT_CLASS}
              />
            </label>
          </div>
        </div>

        {hasInvalidDateRange && (
          <EmptyState
            icon={ClipboardList}
            title="Rango de fechas inválido"
            description='"Desde" no puede ser posterior a "Hasta"'
          />
        )}

        {!hasInvalidDateRange && isError && (
          <ErrorState message="Error al cargar los casos" onRetry={refetch} />
        )}

        {!hasInvalidDateRange && isLoading && (
          <TableSkeleton rows={6} widths={['w-40', 'w-28', 'w-24', 'w-20']} />
        )}

        {!hasInvalidDateRange && !isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title={isFiltered ? 'Sin resultados para estos filtros' : 'No hay casos abiertos'}
            description={
              isFiltered
                ? 'Prueba con otro estado, bodega, producto o rango de fechas'
                : 'Los casos aparecen al confirmar una EAI con motivo «negativo»'
            }
          />
        )}

        {!hasInvalidDateRange && !isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-ui-border">
                  {COLUMNS.map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {items.map((row) => {
                  const isOverdue = row.status === 'open' && row.daysOpen > OVERDUE_DAYS
                  return (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/inventory-cases/${row.id}`)}
                      className="transition-colors cursor-pointer hover:bg-surface-raised"
                    >
                      <td className="px-4 py-3.5 font-mono text-xs font-medium text-content">
                        {row.number}
                      </td>
                      <td className="px-4 py-3.5 text-content-secondary">
                        {formatBogotaDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-content">
                        {row.product.code}
                      </td>
                      <td className="px-4 py-3.5 text-content max-w-[260px]">
                        <span className="truncate block">{row.product.description}</span>
                      </td>
                      <td className="px-4 py-3.5 text-content-secondary">
                        {row.product.brandName}
                      </td>
                      <td className="px-4 py-3.5 text-content-secondary">{row.warehouse.name}</td>
                      <td className="px-4 py-3.5 font-medium text-content">
                        {row.stockBefore} → {row.stockAfter}{' '}
                        <span className="text-content-muted font-normal">
                          ({formatSignedQuantity(row.quantity)})
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <DocumentLink document={row.adjustmentDocument} stopPropagation />
                      </td>
                      <td className="px-4 py-3.5 text-content-secondary">{row.adjustedBy.name}</td>
                      <td className="px-4 py-3.5 text-content-secondary">
                        {row.closedAt ? formatBogotaDate(row.closedAt) : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 font-medium',
                            isOverdue ? 'text-red-600 dark:text-red-400' : 'text-content-secondary',
                          )}
                        >
                          {isOverdue && (
                            <TriangleAlert className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          {row.daysOpen}
                          {isOverdue && (
                            <span className="sr-only"> (más de {OVERDUE_DAYS} días abierto)</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <CaseStatusPill status={row.status} />
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
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(value) => {
              setLimit(value)
              setPage(1)
            }}
          />
        )}
      </div>
    </div>
  )
}
