import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { toast } from 'sonner'
import { Coins } from 'lucide-react'
import type {
  ExcessItem,
  ExcessPartyType,
  ExcessStatus,
  ExcessUsage,
  VoidExcessBody,
} from '@contracts/excesses'

import { getExcesses, voidExcess } from '@/services/excesses.service'
import {
  EmptyState,
  ErrorState,
  SegmentedToggle,
  TablePagination,
  TableSkeleton,
  TableToolbar,
  DEFAULT_PAGE_SIZE,
} from '@/components/shared'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { docNumber, formatCOP, formatDateOnly } from '@/lib/format'
import { CREDIT_STATUS_BADGE } from '@/pages/credits/credits.constants'
import { RegisterExcessPanel } from './RegisterExcessPanel'
import { VoidExcessDialog } from './VoidExcessDialog'
import { VOID_REASON_LABELS } from './excess.rules'

type StatusFilter = ExcessStatus | ''

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'available', label: 'Disponible' },
  { value: 'used', label: 'Usado' },
  { value: 'voided', label: 'Anulado' },
]

const COLUMN_HEADERS = [
  'Número',
  'Fecha',
  'Cliente',
  'Sucursal',
  'Valor',
  'Estado',
  'Usado en / motivo',
]

function getUsageLink(usage: ExcessUsage) {
  return usage.documentType === 'RC'
    ? `/customer-payments/${usage.id}`
    : `/supplier-payments/${usage.id}`
}

function getVoidLabel(excess: ExcessItem) {
  if (!excess.voidReason) return '—'
  if (excess.voidReason === 'otro') return excess.voidReasonOther ?? VOID_REASON_LABELS.otro
  return VOID_REASON_LABELS[excess.voidReason]
}

export default function ExcessesPage() {
  const queryClient = useQueryClient()

  const [partyType, setPartyType] = useState<ExcessPartyType>('customer')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [voiding, setVoiding] = useState<ExcessItem | null>(null)

  const [debouncedSearch] = useDebounce(search, 400)
  const isCustomer = partyType === 'customer'

  // Ajuste de estado durante el render: resetea la página sin un fetch intermedio con la página vieja.
  const [prevFilters, setPrevFilters] = useState({ debouncedSearch, status, partyType })
  if (
    prevFilters.debouncedSearch !== debouncedSearch ||
    prevFilters.status !== status ||
    prevFilters.partyType !== partyType
  ) {
    setPrevFilters({ debouncedSearch, status, partyType })
    setPage(1)
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['excesses', partyType, debouncedSearch, status, page, limit],
    queryFn: () =>
      getExcesses({
        partyType,
        search: debouncedSearch || undefined,
        status: status || undefined,
        page,
        limit,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  const voidMutation = useMutation({
    mutationFn: ({ excess, body }: { excess: ExcessItem; body: VoidExcessBody }) =>
      voidExcess(excess.partyType, excess.id, body),
  })

  async function handleVoid(excess: ExcessItem, body: VoidExcessBody) {
    try {
      await voidMutation.mutateAsync({ excess, body })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['excesses'] }),
        queryClient.invalidateQueries({ queryKey: ['credits'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts-payable'] }),
      ])
      toast.success('Excedente anulado correctamente')
      setVoiding(null)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Error al anular el excedente'))
    }
  }

  const items = data?.items ?? []
  const total = data?.meta.total ?? 0
  const totalPages = data?.meta.totalPages ?? 1
  const headers = COLUMN_HEADERS.filter((header) => isCustomer || header !== 'Sucursal').map(
    (header) => (header === 'Cliente' && !isCustomer ? 'Proveedor' : header),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-content">Excedentes</h1>
        <p className="text-content-muted text-sm mt-0.5 font-accent">
          Plata a favor de un cliente o proveedor. Se usa completa en un recibo o egreso, o no se
          usa.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">
        <section aria-label="Lista de excedentes" className="card-hard overflow-hidden min-w-0">
          <div className="border-b border-ui-border">
            <TableToolbar
              search={search}
              onSearchChange={setSearch}
              placeholder={
                isCustomer ? 'Buscar cliente, NIT o número' : 'Buscar proveedor, NIT o número'
              }
              isLoading={isLoading}
              itemCount={items.length}
              total={total}
              onRefresh={refetch}
            />
            <div className="px-5 pb-4 flex flex-wrap items-center gap-3">
              <SegmentedToggle
                checked={!isCustomer}
                onChange={(checked) => setPartyType(checked ? 'supplier' : 'customer')}
                uncheckedLabel="Clientes"
                checkedLabel="Proveedores"
              />
              <select
                aria-label="Estado"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                className="input-hard text-sm px-3 py-1.5"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isError && <ErrorState message="Error al cargar los excedentes" onRetry={refetch} />}

          {isLoading && <TableSkeleton rows={6} widths={['w-28', 'w-24', 'w-40', 'w-24']} />}

          {!isLoading && !isError && items.length === 0 && (
            <EmptyState
              icon={Coins}
              title={
                debouncedSearch
                  ? `Sin resultados para "${debouncedSearch}"`
                  : 'No hay excedentes registrados'
              }
              description={
                debouncedSearch
                  ? 'Prueba con otro nombre, NIT o número'
                  : 'Los excedentes se registran desde el panel "Registrar excedente"'
              }
            />
          )}

          {!isLoading && !isError && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ui-border">
                    {headers.map((header) => (
                      <th
                        key={header}
                        className={cn(
                          'text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3',
                          header === 'Valor' && 'text-right',
                        )}
                      >
                        {header}
                      </th>
                    ))}
                    <th className="px-4 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-divide">
                  {items.map((excess) => {
                    const isVoided = excess.status === 'voided'
                    const canVoid = excess.status === 'available'
                    const badge = CREDIT_STATUS_BADGE[excess.status]
                    return (
                      <tr
                        key={`${excess.partyType}-${excess.id}`}
                        className={cn(
                          'hover:bg-surface-raised transition-colors',
                          isVoided && 'text-content-faint',
                        )}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium whitespace-nowrap">
                          {docNumber('EXC', excess.number)}
                        </td>
                        <td className="px-4 py-3 text-xs text-content-muted whitespace-nowrap">
                          {formatDateOnly(excess.date)}
                        </td>
                        <td className="px-4 py-3 font-medium">{excess.thirdParty.name}</td>
                        {isCustomer && (
                          <td className="px-4 py-3 text-xs text-content-muted whitespace-nowrap">
                            {excess.customerBranch?.name ?? 'Sin sucursal'}
                          </td>
                        )}
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-medium whitespace-nowrap',
                            isVoided && 'line-through',
                          )}
                        >
                          {formatCOP(Number(excess.amount))}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('pill-stamp', badge.className)}>{badge.label}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {isVoided ? (
                            <span>{getVoidLabel(excess)}</span>
                          ) : excess.usages.length > 0 ? (
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {excess.usages.map((usage) => (
                                <Link
                                  key={usage.id}
                                  to={getUsageLink(usage)}
                                  className="font-mono font-semibold text-content hover:underline underline-offset-2"
                                >
                                  {docNumber(usage.documentType, usage.number)}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="text-content-faint">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!isVoided && (
                            <button
                              type="button"
                              disabled={!canVoid}
                              title={canVoid ? undefined : 'Un excedente usado no se puede anular'}
                              onClick={() => setVoiding(excess)}
                              className="btn-secondary px-2.5 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Anular
                            </button>
                          )}
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
        </section>

        <RegisterExcessPanel initialPartyType="customer" />
      </div>

      {voiding && (
        <VoidExcessDialog
          excessLabel={docNumber('EXC', voiding.number)}
          isPending={voidMutation.isPending}
          onConfirm={(body) => handleVoid(voiding, body)}
          onCancel={() => setVoiding(null)}
        />
      )}
    </div>
  )
}
