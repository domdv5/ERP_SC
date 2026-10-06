import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, RefreshCw } from 'lucide-react'
import { getOfficialLedgerProduct } from '@/services/official-ledger.service'
import { EmptyState, ErrorState } from '@/components/shared'
import { cn } from '@/lib/utils'
import { docNumber, formatDateOnly } from '@/lib/format'
import { DOC_TYPE_BADGE } from '@/pages/documents/document.constants'

const formatQty = (n: number) => n.toLocaleString('es-CO')
const formatSigned = (n: number) => (n > 0 ? `+${formatQty(n)}` : formatQty(n))

const dateInputClass =
  'text-sm bg-surface-raised border border-ui-border-medium rounded-lg px-3 py-1.5 text-content focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-all'

export default function OfficialLedgerProductPage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // El rango llega desde el listado por la URL, pero se puede ajustar acá.
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '')
  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo)

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['official-ledger', 'product', productId, dateFrom, dateTo],
    queryFn: () =>
      getOfficialLedgerProduct(productId!, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(productId) && !hasInvalidDateRange,
  })

  const backButton = (
    <button
      onClick={() => navigate('/official-ledger')}
      className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Volver al libro oficial
    </button>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        {backButton}
        <div className="bg-surface rounded-2xl border border-ui-border p-6 space-y-4 animate-pulse">
          <div className="h-7 w-64 rounded-lg bg-surface-hover" />
          <div className="h-4 w-40 rounded-lg bg-surface-hover" />
        </div>
        <div className="bg-surface rounded-2xl border border-ui-border p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-hover animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-4">
        {backButton}
        <div className="bg-surface rounded-2xl border border-ui-border">
          <ErrorState message="Error al cargar el detalle del producto" onRetry={refetch} />
        </div>
      </div>
    )
  }

  const movements = data?.movements ?? []

  return (
    <div className="space-y-6 pb-10">
      {backButton}

      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6 border-l-4 border-l-brand-secondary">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl text-content">{data?.product.name ?? 'Producto'}</h1>
            <p className="text-content-muted text-sm mt-0.5 font-mono">{data?.product.code}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-content-muted">
              Desde
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo || undefined}
                className={dateInputClass}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-content-muted">
              Hasta
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
                className={dateInputClass}
              />
            </label>
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg text-content-faint hover:text-content-muted hover:bg-surface-hover transition-colors"
              title="Recargar"
            >
              <div className={cn(isFetching && 'animate-spin')}>
                <RefreshCw className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5 border-t border-ui-divide pt-5 max-w-md">
          <div>
            <p className="text-xs text-content-faint font-accent">Saldo inicial</p>
            <p className="text-lg text-content mt-0.5">{formatQty(data?.openingBalance ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-content-faint font-accent">Saldo final</p>
            <p
              className={cn(
                'text-lg mt-0.5',
                (data?.closingBalance ?? 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-content',
              )}
            >
              {formatQty(data?.closingBalance ?? 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-divide">
          <h2 className="text-base text-content">
            Movimientos
            <span className="ml-2 text-sm text-content-faint font-normal">
              ({movements.length})
            </span>
          </h2>
        </div>

        {hasInvalidDateRange ? (
          <EmptyState
            icon={BookOpen}
            title="Rango de fechas inválido"
            description='"Desde" no puede ser posterior a "Hasta"'
          />
        ) : movements.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Sin movimientos en este rango"
            description="Este producto no tiene compras ni ventas oficiales confirmadas en las fechas elegidas"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Fecha', 'Documento', 'Tercero', 'Cantidad', 'Saldo acumulado'].map((h) => (
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
                <tr className="bg-surface-raised">
                  <td colSpan={4} className="px-5 py-3 text-xs font-medium text-content-muted">
                    Saldo inicial
                  </td>
                  <td className="px-5 py-3 text-sm text-content-secondary">
                    {formatQty(data?.openingBalance ?? 0)}
                  </td>
                </tr>
                {movements.map((m, i) => {
                  const badge = DOC_TYPE_BADGE[m.type]
                  return (
                    <tr
                      key={`${m.documentId}-${i}`}
                      onClick={() => navigate(`/documents/${m.documentId}`)}
                      className="hover:bg-surface-raised transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                        {formatDateOnly(m.date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium text-content">
                            {docNumber(m.type, m.number)}
                          </span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-content-secondary text-xs max-w-[220px]">
                        <span className="truncate block">{m.thirdPartyName ?? '—'}</span>
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3.5 text-sm font-medium',
                          m.quantity > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-content-secondary',
                        )}
                      >
                        {formatSigned(m.quantity)}
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3.5 text-sm font-medium',
                          m.runningBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-content',
                        )}
                      >
                        {formatQty(m.runningBalance)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
