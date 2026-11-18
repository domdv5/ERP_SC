import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { PiggyBank } from 'lucide-react'

import { getCredits } from '@/services/credits.service'
import { usePermission } from '@/hooks/usePermission'
import {
  PartySearchSuggestions,
  TableToolbar,
  TableSkeleton,
  EmptyState,
  ErrorState,
  TablePagination,
  DEFAULT_PAGE_SIZE,
} from '@/components/shared'
import type { PickedParty } from '@/components/shared'
import { cn } from '@/lib/utils'
import { formatCOP } from '@/lib/format'
import type { CreditsTab } from './credits.constants'

const TAB_LABEL: Record<CreditsTab, string> = { clientes: 'Clientes', proveedores: 'Proveedores' }

export default function CreditsListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const canCustomers = usePermission('ar.read')
  const canSuppliers = usePermission('ap.read')

  const tabs: CreditsTab[] = [
    ...(canCustomers ? (['clientes'] as const) : []),
    ...(canSuppliers ? (['proveedores'] as const) : []),
  ]
  const requestedTab = searchParams.get('tab')
  const tab: CreditsTab = tabs.find((t) => t === requestedTab) ?? tabs[0] ?? 'clientes'
  const party = tab === 'clientes' ? 'customers' : 'suppliers'

  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<PickedParty | null>(null)
  const [onlyAvailable, setOnlyAvailable] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [debouncedSearch] = useDebounce(search, 400)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, onlyAvailable, tab])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['credits', party, debouncedSearch, onlyAvailable, page, limit],
    queryFn: () =>
      getCredits(party, { search: debouncedSearch || undefined, onlyAvailable, page, limit }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    enabled: tabs.length > 0,
  })

  const items = data?.items ?? []
  const total = data?.meta.total ?? 0
  const totalPages = data?.meta.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-content">Saldos a favor</h1>
        <p className="text-content-muted text-sm mt-0.5 font-accent">
          Consulta lo que cada cliente o proveedor tiene a favor y dónde se ha usado
        </p>
      </div>

      <div className="card-hard overflow-hidden">
        {tabs.length > 1 && (
          <div className="flex gap-1 px-5 pt-3 border-b border-ui-border" role="tablist">
            {tabs.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={t === tab}
                onClick={() => {
                  setPicked(null)
                  setSearch('')
                  setSearchParams({ tab: t }, { replace: true })
                }}
                className={cn(
                  'px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
                  t === tab
                    ? 'border-brand-secondary text-content'
                    : 'border-transparent text-content-muted hover:text-content',
                )}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        )}

        <div className="border-b border-ui-border">
          <PartySearchSuggestions
            key={tab}
            role={tab === 'clientes' ? 'customer' : 'supplier'}
            search={search}
            debouncedSearch={debouncedSearch}
            picked={picked}
            onPick={(chosen) => {
              setPicked(chosen)
              setSearch(chosen.name)
            }}
            onClear={() => {
              setPicked(null)
              setSearch('')
            }}
          >
            <TableToolbar
              search={search}
              onSearchChange={(value) => {
                setPicked(null)
                setSearch(value)
              }}
              placeholder="Buscar por nombre o documento…"
              isLoading={isLoading}
              itemCount={items.length}
              total={total}
              onRefresh={refetch}
            />
          </PartySearchSuggestions>
          <div className="px-5 py-3">
            <label className="inline-flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="w-4 h-4 rounded border-ui-border-medium text-brand-secondary focus:ring-brand-secondary/30"
              />
              Solo con saldo disponible
            </label>
          </div>
        </div>

        {isError && <ErrorState message="Error al cargar los saldos a favor" onRetry={refetch} />}

        {isLoading && <TableSkeleton rows={6} widths={['w-40', 'w-28', 'w-16', 'w-24']} />}

        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            icon={PiggyBank}
            title={
              debouncedSearch ? `Sin resultados para "${debouncedSearch}"` : 'No hay saldos a favor'
            }
            description={
              debouncedSearch
                ? 'Prueba con otro nombre o documento'
                : 'Apaga el filtro "Solo con saldo disponible" para ver también los ya usados'
            }
          />
        )}

        {!isLoading && !isError && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Tercero', 'Documento', 'Saldos', 'Total disponible'].map((h) => (
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
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/saldos-a-favor/${tab}/${item.id}`)}
                    className="hover:bg-surface-raised transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 avatar-outline">
                          {item.name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span className="font-medium text-content">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-content-muted whitespace-nowrap">
                      {item.documentNumber}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary tabular-nums">
                      {item.creditCount}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-content whitespace-nowrap tabular-nums">
                      {formatCOP(Number(item.availableTotal))}
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
