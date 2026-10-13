import { PackageSearch } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { formatCOP } from '@/lib/format'
import type { RotationRow } from '@/types/reports.types'
import {
  AXIS_TICK,
  CHART_COLORS,
  formatCompact,
  formatNumber,
  type DateRangeValue,
} from '../reports.utils'
import { useRotationReport } from '../hooks/useReportQueries'
import { ReportCard } from './ReportCard'
import { ChartTooltip, HorizontalBarChart } from './HorizontalBarChart'

interface RotationSectionProps extends DateRangeValue {
  warehouseId: string | null
  warehouseName: string | null
}

function RotationTooltip({ row }: { row: RotationRow }) {
  return (
    <>
      <p className="text-content font-semibold">
        {row.code} · {row.description}
      </p>
      <p>Unidades vendidas netas: {formatNumber(row.unitsSold)}</p>
      <p>Monto vendido: {formatCOP(row.salesAmount)}</p>
      <p>Stock actual: {formatNumber(row.stock)}</p>
      {row.unitsSold < 0 && (
        <p className="text-amber-600 dark:text-amber-400">Más devoluciones que ventas</p>
      )}
    </>
  )
}

function StockVsSalesChart({ rows }: { rows: RotationRow[] }) {
  const renderContent = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null
    const row: RotationRow | undefined = payload[0]?.payload
    return row ? (
      <ChartTooltip>
        <RotationTooltip row={row} />
      </ChartTooltip>
    ) : null
  }

  return (
    <div
      role="img"
      aria-label="Gráfico de barras agrupadas: stock actual frente a unidades vendidas de los productos de menor rotación"
      style={{ height: rows.length * 52 + 56 }}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickFormatter={formatCompact}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="code"
            width={96}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip content={renderContent} cursor={{ fill: CHART_COLORS.cursor }} />
          <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="stock"
            name="Stock actual"
            fill={CHART_COLORS.neutral}
            radius={[0, 6, 6, 0]}
            maxBarSize={14}
          />
          <Bar dataKey="unitsSold" name="Unidades vendidas" radius={[0, 6, 6, 0]} maxBarSize={14}>
            {rows.map((row) => (
              <Cell
                key={row.productId}
                fill={row.unitsSold < 0 ? CHART_COLORS.warning : CHART_COLORS.primary}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RotationSection({ from, to, warehouseId, warehouseName }: RotationSectionProps) {
  const { data, isLoading, isError, isPlaceholderData, refetch } = useRotationReport(
    { from, to },
    warehouseId,
  )
  const scope = warehouseName ? `en ${warehouseName}` : 'en todas las bodegas'
  const top = data?.top ?? []
  const bottom = data?.bottom ?? []

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ReportCard
        title="Mayor rotación"
        subtitle={`¿Qué productos se venden más ${scope}? Unidades netas (ventas − devoluciones) del período.`}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isEmpty={top.length === 0}
        emptyIcon={PackageSearch}
        emptyTitle="Sin ventas en el período"
        emptyDescription="Prueba con un rango más amplio u otra bodega"
        isRefreshing={isPlaceholderData}
      >
        <HorizontalBarChart
          data={top}
          getLabel={(row) => row.code}
          getValue={(row) => row.unitsSold}
          getColor={(row) => (row.unitsSold < 0 ? CHART_COLORS.warning : CHART_COLORS.primary)}
          renderTooltip={(row) => <RotationTooltip row={row} />}
          ariaLabel="Gráfico de barras con los productos de mayor rotación por unidades vendidas"
          formatTick={formatNumber}
          labelWidth={96}
        />
      </ReportCard>

      <ReportCard
        title="Menor rotación"
        subtitle={`¿Qué productos con stock casi no se mueven ${scope}? Compara existencias contra ventas.`}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isEmpty={bottom.length === 0}
        emptyIcon={PackageSearch}
        emptyTitle="Sin productos con stock"
        emptyDescription="No hay existencias para analizar en esta selección"
        isRefreshing={isPlaceholderData}
      >
        <StockVsSalesChart rows={bottom} />
      </ReportCard>
    </div>
  )
}
