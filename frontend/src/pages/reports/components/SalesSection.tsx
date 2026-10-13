import { useMemo } from 'react'
import { Info, ShoppingBag, UserRound } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { formatCOP } from '@/lib/format'
import type { SalesTrendPoint, SellerSalesRow } from '@/types/reports.types'
import {
  AXIS_TICK,
  CHART_COLORS,
  formatCompact,
  formatNumber,
  formatShortDay,
  type DateRangeValue,
} from '../reports.utils'
import { useSalesBySellerReport } from '../hooks/useReportQueries'
import { ReportCard } from './ReportCard'
import { ChartTooltip } from './HorizontalBarChart'

function TrendChart({ trend }: { trend: SalesTrendPoint[] }) {
  const renderContent = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null
    const point: SalesTrendPoint | undefined = payload[0]?.payload
    if (!point) return null
    return (
      <ChartTooltip>
        <p className="text-content font-semibold">{formatShortDay(point.date)}</p>
        <p>Ventas netas: {formatCOP(point.netSales)}</p>
        {point.netSales < 0 && (
          <p className="text-amber-600 dark:text-amber-400">Día con más devoluciones que ventas</p>
        )}
      </ChartTooltip>
    )
  }

  return (
    <div
      role="img"
      aria-label="Gráfico de área con las ventas netas diarias del período"
      className="h-64 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={AXIS_TICK}
            tickFormatter={formatShortDay}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={AXIS_TICK}
            tickFormatter={formatCompact}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <ReferenceLine y={0} stroke={CHART_COLORS.axis} strokeDasharray="4 4" />
          <Tooltip content={renderContent} />
          <Area
            type="monotone"
            dataKey="netSales"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            fill={CHART_COLORS.primarySoft}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function SellerRanking({ sellers, scale }: { sellers: SellerSalesRow[]; scale: number }) {
  return (
    <ol className="space-y-3" aria-label="Ranking de vendedoras por ventas netas">
      {sellers.map((seller, index) => {
        const returnsPart = Math.min(seller.returns, seller.grossSales)
        const netPart = Math.max(seller.netSales, 0)
        return (
          <li key={seller.sellerId} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-content text-sm truncate">
                <span className="text-content-faint tabular-nums mr-2">{index + 1}</span>
                {seller.name}
              </p>
              <p
                className={
                  seller.netSales < 0
                    ? 'text-amber-600 dark:text-amber-400 text-sm font-semibold tabular-nums shrink-0'
                    : 'text-content text-sm font-semibold tabular-nums shrink-0'
                }
              >
                {formatCOP(seller.netSales)}
              </p>
            </div>
            <div
              role="img"
              aria-label={`${seller.name}: ventas ${formatCOP(seller.grossSales)}, devoluciones ${formatCOP(seller.returns)}`}
              className="mt-1 flex h-2.5 rounded-full bg-surface-hover overflow-hidden"
              style={{ width: `${Math.max(2, (seller.grossSales / scale) * 100)}%` }}
            >
              <div
                className="h-full"
                style={{
                  width: `${seller.grossSales > 0 ? (netPart / seller.grossSales) * 100 : 0}%`,
                  backgroundColor: CHART_COLORS.primary,
                }}
              />
              <div
                className="h-full"
                style={{
                  width: `${seller.grossSales > 0 ? (returnsPart / seller.grossSales) * 100 : 0}%`,
                  backgroundColor: CHART_COLORS.warning,
                }}
              />
            </div>
            <p className="text-content-muted text-xs mt-1">
              Ventas {formatCOP(seller.grossSales)} · Devoluciones {formatCOP(seller.returns)} ·{' '}
              {formatNumber(seller.documentCount)} documentos
            </p>
          </li>
        )
      })}
    </ol>
  )
}

export function SalesSection({ from, to }: DateRangeValue) {
  const { data, isLoading, isError, isPlaceholderData, refetch } = useSalesBySellerReport({
    from,
    to,
  })
  const retry = () => void refetch()

  const ranking = useMemo(
    () => [...(data?.sellers ?? [])].sort((a, b) => b.netSales - a.netSales),
    [data],
  )
  const scale = useMemo(() => Math.max(1, ...ranking.map((s) => s.grossSales)), [ranking])
  const hasTrendData = (data?.trend ?? []).some((p) => p.netSales !== 0)
  const unassignedReturns = data?.unassignedReturns ?? 0

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ReportCard
        title="Tendencia de ventas netas"
        subtitle="¿Cómo se comportan las ventas día a día? Un día bajo cero tuvo más devoluciones que ventas."
        isLoading={isLoading}
        isError={isError}
        onRetry={retry}
        isEmpty={!hasTrendData}
        emptyIcon={ShoppingBag}
        emptyTitle="Sin ventas en el período"
        emptyDescription="Prueba con un rango más amplio"
        isRefreshing={isPlaceholderData}
      >
        <TrendChart trend={data?.trend ?? []} />
      </ReportCard>

      <ReportCard
        title="Ventas por vendedora"
        subtitle="¿Quién vende más, y cuánto se les devuelve? Verde = neto, ámbar = devoluciones."
        isLoading={isLoading}
        isError={isError}
        onRetry={retry}
        isEmpty={ranking.length === 0}
        emptyIcon={UserRound}
        emptyTitle="Sin ventas por vendedora"
        emptyDescription="No hay ventas con vendedora asignada en el período"
        isRefreshing={isPlaceholderData}
      >
        <SellerRanking sellers={ranking} scale={scale} />
        {unassignedReturns > 0 && (
          <div className="mt-4 pt-3 border-t border-ui-divide flex items-center gap-2 text-xs text-content-muted">
            <span>
              Devoluciones sin asignar:{' '}
              <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                {formatCOP(unassignedReturns)}
              </span>
            </span>
            <span className="relative group">
              <button
                type="button"
                aria-label="¿Qué son las devoluciones sin asignar?"
                className="p-0.5 rounded text-content-faint hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary/40"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <span
                role="tooltip"
                className="hidden group-hover:block group-focus-within:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-xl border border-ui-border-medium bg-surface px-3 py-2 shadow-md text-xs text-content-secondary z-10"
              >
                Devoluciones registradas sin vendedora. Como la devolución no enlaza la venta
                original, no se pueden descontar a nadie en el ranking; sí restan de las ventas
                netas totales.
              </span>
            </span>
          </div>
        )}
      </ReportCard>
    </div>
  )
}
