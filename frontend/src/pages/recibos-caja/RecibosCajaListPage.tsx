import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { Wallet, Plus } from 'lucide-react'

import { getRecibosCaja } from '@/services/recibos-caja.service'
import { getThirdParties } from '@/services/third-parties.service'
import { usePermission } from '@/hooks/usePermission'
import { useCustomerBranches } from '@/hooks/useCustomerBranches'
import {
  Combobox,
  TableToolbar,
  TableSkeleton,
  EmptyState,
  ErrorState,
  TablePagination,
  DEFAULT_PAGE_SIZE,
} from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { formatCOP, docNumber, formatDateOnly } from '@/lib/format'
import type { ThirdParty } from '@/types/third-party.types'

export default function RecibosCajaListPage() {
  const navigate = useNavigate()
  const canCreate = usePermission('recibo.create')

  const [search, setSearch] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSelectedName, setClientSelectedName] = useState('')
  const [branchId, setBranchId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)

  const [debouncedSearch] = useDebounce(search, 400)
  const [debouncedClientSearch] = useDebounce(clientSearch, 400)

  // Ajuste de estado durante el render: resetea la página sin disparar un fetch intermedio con el filtro nuevo y la página vieja.
  const [prevFilters, setPrevFilters] = useState({
    debouncedSearch,
    clientId,
    branchId,
    dateFrom,
    dateTo,
  })
  if (
    prevFilters.debouncedSearch !== debouncedSearch ||
    prevFilters.clientId !== clientId ||
    prevFilters.branchId !== branchId ||
    prevFilters.dateFrom !== dateFrom ||
    prevFilters.dateTo !== dateTo
  ) {
    setPrevFilters({ debouncedSearch, clientId, branchId, dateFrom, dateTo })
    setPage(1)
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['recibos-caja', debouncedSearch, clientId, branchId, dateFrom, dateTo, page, limit],
    queryFn: () =>
      getRecibosCaja({
        number: debouncedSearch || undefined,
        clientId: clientId || undefined,
        customerBranchId: branchId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  const { branches: clientBranches } = useCustomerBranches(clientId || undefined)

  const items = data?.items ?? []
  const total = data?.meta.total ?? 0
  const totalPages = data?.meta.totalPages ?? 1

  // Excepción intencional al patrón de <select> nativo de esta fila de filtros: a diferencia
  // de un enum, elegir cliente requiere búsqueda, así que va un Combobox server-side.
  const hasClientSearch = debouncedClientSearch.length >= 1
  const { data: clientData, isLoading: isLoadingClients } = useQuery({
    queryKey: ['third-parties-search-customers', debouncedClientSearch],
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

  const clientOptions: ComboboxOption[] = (clientData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
  }))
  const clientDisplayOptions: ComboboxOption[] =
    clientId && !debouncedClientSearch
      ? [
          { id: clientId, label: clientSelectedName },
          ...clientOptions.filter((o) => o.id !== clientId),
        ]
      : clientOptions

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">Recibos de caja</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">
            Cobros a clientes registrados contra sus cuentas por cobrar
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => navigate('/recibos-caja/new')}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo recibo de caja
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card-hard overflow-hidden">
        <div className="border-b border-ui-border">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Buscar por número..."
            isLoading={isLoading}
            itemCount={items.length}
            total={total}
            onRefresh={refetch}
          />
          <div className="px-5 pb-4 flex flex-wrap items-center gap-3">
            <div className="w-56">
              <Combobox
                value={clientId}
                onChange={(id, option) => {
                  setClientId(id)
                  setClientSelectedName(option.label)
                  setBranchId('')
                }}
                options={clientDisplayOptions}
                isLoading={isLoadingClients}
                placeholder="Todos los clientes"
                searchValue={clientSearch}
                onSearchChange={setClientSearch}
              />
            </div>
            {clientId && (
              <button
                onClick={() => {
                  setClientId('')
                  setClientSelectedName('')
                  setBranchId('')
                }}
                className="text-xs text-content-faint hover:text-content-muted underline"
              >
                Quitar cliente
              </button>
            )}
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
            <div className="flex items-center gap-2">
              <label className="text-xs text-content-faint">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-hard text-sm border-ui-border-medium px-3 py-1.5 text-content transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-content-faint">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-hard text-sm border-ui-border-medium px-3 py-1.5 text-content transition-all"
              />
            </div>
          </div>
        </div>

        {isError && <ErrorState message="Error al cargar los recibos de caja" onRetry={refetch} />}

        {isLoading && <TableSkeleton rows={6} widths={['w-32', 'w-40', 'w-24', 'w-20']} />}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={Wallet}
            title={
              debouncedSearch
                ? `Sin resultados para "${debouncedSearch}"`
                : 'No hay recibos de caja registrados'
            }
            description={
              debouncedSearch
                ? 'Prueba con otro número de recibo'
                : 'Los recibos de caja se registran desde el botón "Nuevo recibo de caja"'
            }
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Número', 'Fecha', 'Cliente', 'Sucursal', 'Total'].map((h) => (
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
                {items.map((reciboCaja) => (
                  <tr
                    key={reciboCaja.id}
                    onClick={() => navigate(`/recibos-caja/${reciboCaja.id}`)}
                    className="hover:bg-surface-raised transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-medium text-content whitespace-nowrap">
                      {docNumber('RC', reciboCaja.number)}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatDateOnly(reciboCaja.date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 avatar-outline">
                          {reciboCaja.client.thirdParty.name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span className="font-medium text-content">
                          {reciboCaja.client.thirdParty.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {reciboCaja.customerBranch?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(reciboCaja.total))}
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
