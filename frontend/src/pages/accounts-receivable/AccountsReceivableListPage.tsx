import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { TrendingUp, Receipt, CheckCircle2 } from 'lucide-react'
import { getReceivableClients } from '@/services/accounts-receivable.service'
import {
  StatsGrid,
  TableToolbar,
  TableSkeleton,
  EmptyState,
  ErrorState,
  TablePagination,
  DEFAULT_PAGE_SIZE,
} from '@/components/shared'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/utils'
import { formatDate } from './accounts-receivable.utils'
import type { ReceivableClientsStatus } from '@/types'

const STATUS_OPTIONS: { value: ReceivableClientsStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'with_balance', label: 'Con saldo' },
  { value: 'settled', label: 'Al día' },
]

const COLUMNS = [
  'Cliente',
  'Facturas',
  'Total',
  'Pagado',
  'Saldo',
  'Última venta',
  'Último pago',
  'Estado',
]

export default function AccountsReceivableListPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReceivableClientsStatus | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)

  const [debouncedSearch] = useDebounce(search, 400)

  const [prevFilters, setPrevFilters] = useState({
    debouncedSearch,
    statusFilter,
    dateFrom,
    dateTo,
  })
  if (
    prevFilters.debouncedSearch !== debouncedSearch ||
    prevFilters.statusFilter !== statusFilter ||
    prevFilters.dateFrom !== dateFrom ||
    prevFilters.dateTo !== dateTo
  ) {
    setPrevFilters({ debouncedSearch, statusFilter, dateFrom, dateTo })
    setPage(1)
  }

  // El input date nativo no impide escribir un rango invertido a mano; se corta antes de pedirlo
  // al backend (que igual lo rechazaría con 400) para no mostrar el ErrorState genérico.
  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'accounts-receivable',
      'clients',
      debouncedSearch,
      statusFilter,
      dateFrom,
      dateTo,
      page,
      limit,
    ],
    queryFn: () =>
      getReceivableClients({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    enabled: !hasInvalidDateRange,
  })

  // keepPreviousData mantiene la respuesta del filtro anterior mientras la query está
  // deshabilitada por rango inválido; sin este corte, las tarjetas y el contador quedan
  // mostrando números del filtro previo en vez de limpiarse.
  const items = hasInvalidDateRange ? [] : (data?.items ?? [])
  const total = hasInvalidDateRange ? 0 : (data?.meta.total ?? 0)
  const totalPages = hasInvalidDateRange ? 1 : (data?.meta.totalPages ?? 1)
  const totals = hasInvalidDateRange ? undefined : data?.meta.totals

  const statCards = [
    {
      label: 'Saldo total',
      value: formatCOP(Number(totals?.balance ?? 0)),
      icon: TrendingUp,
      bg: 'bg-brand-primary/10',
      fg: 'text-brand-primary dark:text-content',
    },
    {
      label: 'Total vendido a crédito',
      value: formatCOP(Number(totals?.totalAmount ?? 0)),
      icon: Receipt,
      bg: 'bg-amber-500/10',
      fg: 'text-amber-500',
    },
    {
      label: 'Total pagado',
      value: formatCOP(Number(totals?.paidAmount ?? 0)),
      icon: CheckCircle2,
      bg: 'bg-brand-secondary/10',
      fg: 'text-brand-secondary',
    },
  ]

  const hasActiveFilters = Boolean(debouncedSearch || statusFilter || dateFrom || dateTo)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">Cuentas por Cobrar</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">
            Un cliente por fila: entra a su estado de cuenta para ver facturas y sucursales
          </p>
        </div>
      </div>

      <StatsGrid cards={statCards} isLoading={isLoading} />

      {/* Table */}
      <div className="card-hard overflow-hidden">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Buscar cliente..."
          isLoading={isLoading}
          itemCount={items.length}
          total={total}
          onRefresh={() => refetch()}
        />
        <div className="px-5 py-3 border-b-2 border-ui-border-medium flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReceivableClientsStatus | '')}
            className="input-hard text-sm px-3 py-1.5"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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
              className="input-hard text-sm px-3 py-1.5"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-content-muted">
            Hasta
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              className="input-hard text-sm px-3 py-1.5"
            />
          </label>
        </div>

        {hasInvalidDateRange && (
          <EmptyState
            icon={TrendingUp}
            title="Rango de fechas inválido"
            description='"Desde" no puede ser posterior a "Hasta"'
          />
        )}

        {!hasInvalidDateRange && isError && (
          <ErrorState message="Error al cargar las cuentas por cobrar" onRetry={refetch} />
        )}

        {!hasInvalidDateRange && isLoading && (
          <TableSkeleton rows={6} widths={['w-40', 'w-28', 'w-24', 'w-20']} />
        )}

        {!hasInvalidDateRange && !isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={TrendingUp}
            title={
              hasActiveFilters
                ? 'Sin resultados para estos filtros'
                : 'No hay cuentas por cobrar registradas'
            }
            description={
              hasActiveFilters
                ? 'Prueba con otro cliente, estado o rango de fechas'
                : 'Las cuentas se generan automáticamente al confirmar ventas a crédito (COT)'
            }
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-ui-border-medium">
                  {COLUMNS.map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {items.map((row) => {
                  const hasBalance = Number(row.balance) > 0
                  return (
                    <tr
                      key={row.client.id}
                      onClick={() => navigate(`/accounts-receivable/clients/${row.client.id}`)}
                      className="hover:bg-surface-raised transition-colors group cursor-pointer"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 avatar-outline">
                            {row.client.name[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="font-medium text-content">{row.client.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-content-muted text-xs">
                        {row.receivableCount}
                      </td>
                      <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                        {formatCOP(Number(row.totalAmount))}
                      </td>
                      <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                        {formatCOP(Number(row.paidAmount))}
                      </td>
                      <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                        {formatCOP(Number(row.balance))}
                      </td>
                      <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                        {formatDate(row.lastSaleDate)}
                      </td>
                      <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                        {formatDate(row.lastPaymentDate)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'pill-stamp whitespace-nowrap',
                            hasBalance
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
                          )}
                        >
                          {hasBalance ? 'Con saldo' : 'Al día'}
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
