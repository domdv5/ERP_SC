import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Inbox, FileCheck2 } from 'lucide-react'
import { getPendingOfficialPurchases } from '@/services/documents.service'
import { getThirdParties } from '@/services/third-parties.service'
import {
  Combobox,
  TableToolbar,
  TableSkeleton,
  EmptyState,
  ErrorState,
  TablePagination,
} from '@/components/shared'
import type { ComboboxOption } from '@/components/shared'
import { formatCOP, docNumber, formatDateOnly } from '@/lib/format'
import type { ThirdParty } from '@/types/third-party.types'

const ALL_SUPPLIERS_OPTION: ComboboxOption = { id: '', label: 'Todos los proveedores' }

export default function OfficialPurchasesPendingPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierSelectedName, setSupplierSelectedName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const [debouncedSearch] = useDebounce(search, 400)
  const [debouncedSupplierSearch] = useDebounce(supplierSearch, 400)

  const [prevFilters, setPrevFilters] = useState({
    debouncedSearch,
    supplierId,
    dateFrom,
    dateTo,
  })
  if (
    prevFilters.debouncedSearch !== debouncedSearch ||
    prevFilters.supplierId !== supplierId ||
    prevFilters.dateFrom !== dateFrom ||
    prevFilters.dateTo !== dateTo
  ) {
    setPrevFilters({ debouncedSearch, supplierId, dateFrom, dateTo })
    setPage(1)
  }

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

  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['official-purchases-pending', debouncedSearch, supplierId, dateFrom, dateTo, page],
    queryFn: () =>
      getPendingOfficialPurchases({
        search: debouncedSearch || undefined,
        supplierId: supplierId || undefined,
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

  const hasActiveFilters = Boolean(debouncedSearch || supplierId || dateFrom || dateTo)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-content">Compras oficiales pendientes</h1>
        <p className="text-content-muted text-sm mt-0.5 font-accent">
          Compras marcadas como oficiales que aún no tienen su compra oficial registrada
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="border-b border-ui-border">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Buscar por factura o número..."
            isLoading={isLoading}
            itemCount={items.length}
            total={total}
            onRefresh={refetch}
          />
          <div className="px-5 py-4 flex flex-wrap items-center gap-3">
            <div className="w-64">
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
            icon={Inbox}
            title="Rango de fechas inválido"
            description='"Desde" no puede ser posterior a "Hasta"'
          />
        )}

        {!hasInvalidDateRange && isError && (
          <ErrorState message="Error al cargar las compras pendientes" onRetry={refetch} />
        )}

        {!hasInvalidDateRange && isLoading && (
          <TableSkeleton rows={6} widths={['w-40', 'w-28', 'w-24', 'w-20']} />
        )}

        {!hasInvalidDateRange && !isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={Inbox}
            title={
              hasActiveFilters
                ? 'Sin resultados para estos filtros'
                : 'No hay compras oficiales pendientes'
            }
            description={
              hasActiveFilters
                ? 'Prueba con otra factura, proveedor o rango de fechas'
                : 'Aparecen aquí las compras oficiales confirmadas que aún no tienen compra oficial'
            }
          />
        )}

        {!hasInvalidDateRange && !isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Compra', 'Fecha', 'Proveedor', 'Factura', 'Ítems', 'Total', ''].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {items.map((purchase) => (
                  <tr
                    key={purchase.id}
                    onClick={() => navigate(`/documents/${purchase.id}`)}
                    className="hover:bg-surface-raised transition-colors group cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 gradient-dark">
                          <Inbox className="w-4 h-4 text-white/70" />
                        </div>
                        <span className="font-mono text-xs font-medium text-content">
                          {docNumber('CM', purchase.number)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatDateOnly(purchase.date)}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary text-xs max-w-[220px]">
                      <span className="truncate block">{purchase.thirdParty?.name ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-content whitespace-nowrap">
                      {purchase.supplierInvoiceNumber ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">
                      {purchase.documentItems.length}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(purchase.total))}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/documents/new?type=CMO&fromCM=${purchase.id}`)
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg gradient-action hover:opacity-90 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 whitespace-nowrap"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        Crear compra oficial
                      </button>
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
