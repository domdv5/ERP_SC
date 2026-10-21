import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { TrendingUp, Clock, CheckCircle2, RefreshCw } from 'lucide-react'
import { getAccountsReceivable } from '@/services/accounts-receivable.service'
import { getThirdParties } from '@/services/third-parties.service'
import { useCustomerBranches } from '@/hooks/useCustomerBranches'
import {
  Combobox,
  StatsGrid,
  TableSkeleton,
  EmptyState,
  ErrorState,
  TablePagination,
} from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { formatCOP, docNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StatusBadge } from './components/StatusBadge'
import { formatDate, DOCUMENT_TYPE_LABELS } from './accounts-receivable.utils'
import type { AccountsReceivableStatus } from '@/types'
import type { ThirdParty } from '@/types/third-party.types'

const ALL_STATUSES: { value: AccountsReceivableStatus | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'partial', label: 'Parcial' },
  { value: 'paid', label: 'Pagado' },
]

const ALL_CLIENTS_OPTION: ComboboxOption = { id: '', label: 'Todos los clientes' }

export default function AccountsReceivableListPage() {
  const navigate = useNavigate()

  const [clientId, setClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clientSelectedName, setClientSelectedName] = useState('')
  const [branchId, setBranchId] = useState('')
  const [statusFilter, setStatusFilter] = useState<AccountsReceivableStatus | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const [debouncedClientSearch] = useDebounce(clientSearch, 400)

  const [prevFilters, setPrevFilters] = useState({
    clientId,
    branchId,
    statusFilter,
    dateFrom,
    dateTo,
  })
  if (
    prevFilters.clientId !== clientId ||
    prevFilters.branchId !== branchId ||
    prevFilters.statusFilter !== statusFilter ||
    prevFilters.dateFrom !== dateFrom ||
    prevFilters.dateTo !== dateTo
  ) {
    setPrevFilters({ clientId, branchId, statusFilter, dateFrom, dateTo })
    setPage(1)
  }

  // Filtro exacto por cliente: selección de UN tercero vía Combobox, no búsqueda por texto libre.
  const hasClientSearch = debouncedClientSearch.length >= 1
  const { data: clientData, isLoading: isLoadingClients } = useQuery({
    queryKey: ['third-parties-search-clients', debouncedClientSearch],
    queryFn: () =>
      getThirdParties({
        search: debouncedClientSearch || undefined,
        page: 1,
        limit: 30,
        isCustomer: true,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: hasClientSearch,
  })

  const { branches: clientBranches } = useCustomerBranches(clientId || undefined)

  const clientOptions: ComboboxOption[] = (clientData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
  }))
  const clientDisplayOptions: ComboboxOption[] = [
    ALL_CLIENTS_OPTION,
    ...(clientId && !debouncedClientSearch
      ? [{ id: clientId, label: clientSelectedName }, ...clientOptions]
      : clientOptions),
  ]

  // El input date nativo no impide escribir un rango invertido a mano; se corta antes de pedirlo
  // al backend (que igual lo rechazaría con 400) para no mostrar el ErrorState genérico.
  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['accounts-receivable', clientId, branchId, statusFilter, dateFrom, dateTo, page],
    queryFn: () =>
      getAccountsReceivable({
        clientId: clientId || undefined,
        customerBranchId: branchId || undefined,
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    enabled: !hasInvalidDateRange,
  })

  // Conteos por estado para la fila de estadísticas: el listado no trae ese
  // desglose, así que se pide una sola fila por cada estado (sin los filtros activos, son globales).
  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ['accounts-receivable', 'count', 'pending'],
    queryFn: () => getAccountsReceivable({ status: 'pending', page: 1, limit: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: paidData, isLoading: isPaidLoading } = useQuery({
    queryKey: ['accounts-receivable', 'count', 'paid'],
    queryFn: () => getAccountsReceivable({ status: 'paid', page: 1, limit: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: partialData, isLoading: isPartialLoading } = useQuery({
    queryKey: ['accounts-receivable', 'count', 'partial'],
    queryFn: () => getAccountsReceivable({ status: 'partial', page: 1, limit: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  // keepPreviousData mantiene la respuesta del filtro anterior mientras la query está
  // deshabilitada por rango inválido; sin este corte, "Saldo total" y el contador quedan
  // mostrando números del filtro previo en vez de limpiarse.
  const items = hasInvalidDateRange ? [] : (data?.items ?? [])
  const total = hasInvalidDateRange ? 0 : (data?.meta.total ?? 0)
  const totalPages = hasInvalidDateRange ? 1 : (data?.meta.totalPages ?? 1)
  const pendingCount = (pendingData?.meta.total ?? 0) + (partialData?.meta.total ?? 0)
  const paidCount = paidData?.meta.total ?? 0
  const balanceTotal = hasInvalidDateRange ? '0' : (data?.meta.totals.balance ?? '0')

  const statCards = [
    {
      label: 'Saldo total',
      value: formatCOP(Number(balanceTotal)),
      icon: TrendingUp,
      bg: 'bg-brand-primary/10',
      fg: 'text-brand-primary dark:text-content',
    },
    {
      label: 'Pendientes',
      value: pendingCount,
      icon: Clock,
      bg: 'bg-amber-500/10',
      fg: 'text-amber-500',
    },
    {
      label: 'Pagadas',
      value: paidCount,
      icon: CheckCircle2,
      bg: 'bg-brand-secondary/10',
      fg: 'text-brand-secondary',
    },
  ]

  const hasActiveFilters = Boolean(clientId || branchId || statusFilter || dateFrom || dateTo)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">Cuentas por Cobrar</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">
            Ventas a crédito y su estado de cobro
          </p>
        </div>
      </div>

      <StatsGrid
        cards={statCards}
        isLoading={isLoading || isPendingLoading || isPaidLoading || isPartialLoading}
      />

      {/* Table */}
      <div className="card-hard overflow-hidden">
        <div className="border-b-2 border-ui-border-medium">
          <div className="px-5 py-4 flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <Combobox
                value={clientId}
                onChange={(id, option) => {
                  setClientId(id)
                  setBranchId('')
                  setClientSelectedName(option.label)
                }}
                options={clientDisplayOptions}
                isLoading={isLoadingClients}
                placeholder="Filtrar por cliente..."
                searchValue={clientSearch}
                onSearchChange={setClientSearch}
              />
            </div>
            <span className="text-xs text-content-faint ml-auto">
              {isLoading ? '...' : `${items.length} de ${total} registros`}
            </span>
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg text-content-faint hover:text-content-muted hover:bg-surface-hover transition-colors"
              title="Recargar"
            >
              <div className={cn(isLoading && 'animate-spin')}>
                <RefreshCw className="w-4 h-4" />
              </div>
            </button>
          </div>
          <div className="px-5 pb-4 flex flex-wrap gap-3">
            {/* Con una sucursal elegida el selector sigue visible aunque la lista esté recargando, para no ocultar un filtro activo */}
            {clientId && (clientBranches.length > 0 || branchId) && (
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="input-hard text-sm px-3 py-1.5"
              >
                <option value="">Todas las sucursales</option>
                {clientBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AccountsReceivableStatus | '')}
              className="input-hard text-sm px-3 py-1.5"
            >
              {ALL_STATUSES.map((s) => (
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
                  {[
                    'Cliente',
                    'Sucursal',
                    'Documento',
                    'Fecha venta',
                    'Monto total',
                    'Pagado',
                    'Saldo',
                    'Vencimiento',
                    'Estado',
                  ].map((h) => (
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
                {items.map((account) => (
                  <tr
                    key={account.id}
                    onClick={() => navigate(`/accounts-receivable/${account.id}`)}
                    className="hover:bg-surface-raised transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 avatar-outline">
                          {account.client.thirdParty.name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/accounts-receivable/clients/${account.client.id}`)
                          }}
                          className="font-medium link-plain text-left"
                        >
                          {account.client.thirdParty.name}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">
                      {account.document.customerBranch?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-medium text-content">
                          {docNumber(account.document.type, account.document.number)}
                        </span>
                        <span className="text-xs text-content-faint">
                          {DOCUMENT_TYPE_LABELS[account.document.type] ?? account.document.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatDate(account.document.date)}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(account.totalAmount))}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatCOP(Number(account.paidAmount))}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(account.balance))}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatDate(account.dueDate)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={account.status} />
                    </td>
                  </tr>
                ))}
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
