import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Wallet, Clock, CheckCircle2, RefreshCw } from 'lucide-react'
import { getAccountsPayable } from '@/services/accounts-payable.service'
import { getThirdParties } from '@/services/third-parties.service'
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
import { formatDate, DOCUMENT_TYPE_LABELS } from './accounts-payable.utils'
import type { AccountsPayableStatus } from '@/types'
import type { ThirdParty } from '@/types/third-party.types'

const ALL_STATUSES: { value: AccountsPayableStatus | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'partial', label: 'Parcial' },
  { value: 'paid', label: 'Pagado' },
]

const ALL_SUPPLIERS_OPTION: ComboboxOption = { id: '', label: 'Todos los proveedores' }

export default function AccountsPayableListPage() {
  const navigate = useNavigate()

  const [supplierId, setSupplierId] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierSelectedName, setSupplierSelectedName] = useState('')
  const [statusFilter, setStatusFilter] = useState<AccountsPayableStatus | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const [debouncedSupplierSearch] = useDebounce(supplierSearch, 400)

  const [prevFilters, setPrevFilters] = useState({
    supplierId,
    statusFilter,
    dateFrom,
    dateTo,
  })
  if (
    prevFilters.supplierId !== supplierId ||
    prevFilters.statusFilter !== statusFilter ||
    prevFilters.dateFrom !== dateFrom ||
    prevFilters.dateTo !== dateTo
  ) {
    setPrevFilters({ supplierId, statusFilter, dateFrom, dateTo })
    setPage(1)
  }

  // Filtro exacto por proveedor: selección de UN tercero vía Combobox, no búsqueda por texto libre.
  const hasSupplierSearch = debouncedSupplierSearch.length >= 1
  const { data: supplierData, isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['third-parties-search-suppliers', debouncedSupplierSearch],
    queryFn: () =>
      getThirdParties({
        search: debouncedSupplierSearch || undefined,
        page: 1,
        limit: 30,
        isSupplier: true,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: hasSupplierSearch,
  })

  const supplierOptions: ComboboxOption[] = (supplierData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
  }))
  const supplierDisplayOptions: ComboboxOption[] = [
    ALL_SUPPLIERS_OPTION,
    ...(supplierId && !debouncedSupplierSearch
      ? [{ id: supplierId, label: supplierSelectedName }, ...supplierOptions]
      : supplierOptions),
  ]

  // El input date nativo no impide escribir un rango invertido a mano; se corta antes de pedirlo
  // al backend (que igual lo rechazaría con 400) para no mostrar el ErrorState genérico.
  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['accounts-payable', supplierId, statusFilter, dateFrom, dateTo, page],
    queryFn: () =>
      getAccountsPayable({
        supplierId: supplierId || undefined,
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
    queryKey: ['accounts-payable', 'count', 'pending'],
    queryFn: () => getAccountsPayable({ status: 'pending', page: 1, limit: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: paidData, isLoading: isPaidLoading } = useQuery({
    queryKey: ['accounts-payable', 'count', 'paid'],
    queryFn: () => getAccountsPayable({ status: 'paid', page: 1, limit: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: partialData, isLoading: isPartialLoading } = useQuery({
    queryKey: ['accounts-payable', 'count', 'partial'],
    queryFn: () => getAccountsPayable({ status: 'partial', page: 1, limit: 1 }),
    staleTime: 5 * 60 * 1000,
  })

  const items = data?.items ?? []
  const total = data?.meta.total ?? 0
  const totalPages = data?.meta.totalPages ?? 1
  const pendingCount = (pendingData?.meta.total ?? 0) + (partialData?.meta.total ?? 0)
  const paidCount = paidData?.meta.total ?? 0
  const balanceTotal = data?.meta.totals.balance ?? '0'

  const statCards = [
    {
      label: 'Saldo total',
      value: formatCOP(Number(balanceTotal)),
      icon: Wallet,
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

  const hasActiveFilters = Boolean(supplierId || statusFilter || dateFrom || dateTo)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">Cuentas por Pagar</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">
            Obligaciones con proveedores y su estado de pago
          </p>
        </div>
      </div>

      <StatsGrid
        cards={statCards}
        isLoading={isLoading || isPendingLoading || isPaidLoading || isPartialLoading}
      />

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="border-b border-ui-border">
          <div className="px-5 py-4 flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <Combobox
                value={supplierId}
                onChange={(id, option) => {
                  setSupplierId(id)
                  setSupplierSelectedName(option.label)
                }}
                options={supplierDisplayOptions}
                isLoading={isLoadingSuppliers}
                placeholder="Filtrar por proveedor..."
                searchValue={supplierSearch}
                onSearchChange={setSupplierSearch}
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AccountsPayableStatus | '')}
              className="text-sm bg-surface-raised border border-ui-border-medium rounded-lg px-3 py-1.5 text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
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
            icon={Wallet}
            title="Rango de fechas inválido"
            description='"Desde" no puede ser posterior a "Hasta"'
          />
        )}

        {!hasInvalidDateRange && isError && (
          <ErrorState message="Error al cargar las cuentas por pagar" onRetry={refetch} />
        )}

        {!hasInvalidDateRange && isLoading && (
          <TableSkeleton rows={6} widths={['w-40', 'w-28', 'w-24', 'w-20']} />
        )}

        {!hasInvalidDateRange && !isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={Wallet}
            title={
              hasActiveFilters
                ? 'Sin resultados para estos filtros'
                : 'No hay cuentas por pagar registradas'
            }
            description={
              hasActiveFilters
                ? 'Prueba con otro proveedor, estado o rango de fechas'
                : 'Las cuentas se generan automáticamente al confirmar compras'
            }
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {[
                    'Proveedor',
                    'Documento',
                    'Fecha compra',
                    'Monto total',
                    'Pagado',
                    'Saldo a favor aplicado',
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
                    onClick={() => navigate(`/accounts-payable/${account.id}`)}
                    className="hover:bg-surface-raised transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 gradient-user">
                          {account.supplier.thirdParty.name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/accounts-payable/suppliers/${account.supplier.id}`)
                          }}
                          className="font-medium text-brand-secondary hover:underline text-left"
                        >
                          {account.supplier.thirdParty.name}
                        </button>
                      </div>
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
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatCOP(Number(account.creditApplied))}
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
