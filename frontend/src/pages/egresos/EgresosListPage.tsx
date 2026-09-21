import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { Wallet, Plus } from 'lucide-react'

import { getEgresos } from '@/services/egresos.service'
import { getThirdParties } from '@/services/third-parties.service'
import { usePermission } from '@/hooks/usePermission'
import {
  Combobox,
  TableToolbar,
  TableSkeleton,
  EmptyState,
  ErrorState,
  TablePagination,
} from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { formatCOP, docNumber } from '@/lib/format'
import type { ThirdParty } from '@/types/third-party.types'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

export default function EgresosListPage() {
  const navigate = useNavigate()
  const canCreate = usePermission('egreso.create')

  const [search, setSearch] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [supplierSelectedName, setSupplierSelectedName] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const [debouncedSearch] = useDebounce(search, 400)
  const [debouncedSupplierSearch] = useDebounce(supplierSearch, 400)

  // Volver a la página 1 cuando cambia cualquier filtro.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, supplierId, dateFrom, dateTo])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['egresos', debouncedSearch, supplierId, dateFrom, dateTo, page],
    queryFn: () =>
      getEgresos({
        number: debouncedSearch || undefined,
        supplierId: supplierId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  const items = data?.items ?? []
  const total = data?.meta.total ?? 0
  const totalPages = data?.meta.totalPages ?? 1

  // Excepción intencional al patrón de <select> nativo de esta fila de filtros: a diferencia
  // de un enum, elegir proveedor requiere búsqueda, así que va un Combobox server-side.
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
  const supplierDisplayOptions: ComboboxOption[] =
    supplierId && !debouncedSupplierSearch
      ? [
          { id: supplierId, label: supplierSelectedName },
          ...supplierOptions.filter((o) => o.id !== supplierId),
        ]
      : supplierOptions

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-content">Egresos</h1>
          <p className="text-content-muted text-sm mt-0.5 font-accent">
            Pagos a proveedores registrados con dinero y saldo a favor
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => navigate('/egresos/new')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] gradient-action"
          >
            <Plus className="w-4 h-4" />
            Nuevo egreso
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
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
                value={supplierId}
                onChange={(id, option) => {
                  setSupplierId(id)
                  setSupplierSelectedName(option.label)
                }}
                options={supplierDisplayOptions}
                isLoading={isLoadingSuppliers}
                placeholder="Todos los proveedores"
                searchValue={supplierSearch}
                onSearchChange={setSupplierSearch}
              />
            </div>
            {supplierId && (
              <button
                onClick={() => {
                  setSupplierId('')
                  setSupplierSelectedName('')
                }}
                className="text-xs text-content-faint hover:text-content-muted underline"
              >
                Quitar proveedor
              </button>
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs text-content-faint">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm bg-surface-raised border border-ui-border-medium rounded-lg px-3 py-1.5 text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-content-faint">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm bg-surface-raised border border-ui-border-medium rounded-lg px-3 py-1.5 text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all"
              />
            </div>
          </div>
        </div>

        {isError && <ErrorState message="Error al cargar los egresos" onRetry={refetch} />}

        {isLoading && <TableSkeleton rows={6} widths={['w-32', 'w-40', 'w-24', 'w-20']} />}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={Wallet}
            title={
              debouncedSearch
                ? `Sin resultados para "${debouncedSearch}"`
                : 'No hay egresos registrados'
            }
            description={
              debouncedSearch
                ? 'Prueba con otro número de egreso'
                : 'Los egresos se registran desde el botón "Nuevo egreso"'
            }
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Número', 'Fecha', 'Proveedor', 'Total', 'Dinero', 'Saldo a favor'].map((h) => (
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
                {items.map((egreso) => (
                  <tr
                    key={egreso.id}
                    onClick={() => navigate(`/egresos/${egreso.id}`)}
                    className="hover:bg-surface-raised transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-medium text-content whitespace-nowrap">
                      {docNumber('EG', egreso.number)}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatDate(egreso.date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 gradient-user">
                          {egreso.supplier.thirdParty.name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/accounts-payable/suppliers/${egreso.supplier.id}`)
                          }}
                          className="font-medium text-brand-secondary hover:underline text-left"
                        >
                          {egreso.supplier.thirdParty.name}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(egreso.total))}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatCOP(Number(egreso.cashTotal))}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatCOP(Number(egreso.creditTotal))}
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
