import { useState } from 'react'
import { Warehouse } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { SegmentedToggle } from '@/components/shared'
import { formatCOP } from '@/lib/format'
import type { WarehouseStockRow } from '@/types/reports.types'
import { AXIS_TICK, CHART_COLORS, formatCompact, formatNumber, truncate } from '../reports.utils'
import { useInventoryReport } from '../hooks/useReportQueries'
import { ReportCard } from './ReportCard'
import { ChartTooltip } from './HorizontalBarChart'

interface InventorySectionProps {
  warehouseId: string | null
  onWarehouseSelect: (warehouseId: string | null) => void
}

export function InventorySection({ warehouseId, onWarehouseSelect }: InventorySectionProps) {
  const [showValue, setShowValue] = useState(false)
  const { data, isLoading, isError, refetch } = useInventoryReport()

  const warehouses = data?.warehouses ?? []
  const metric = showValue ? 'costValue' : 'units'

  const renderContent = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null
    const row: WarehouseStockRow | undefined = payload[0]?.payload
    if (!row) return null
    return (
      <ChartTooltip>
        <p className="text-content font-semibold">{row.name}</p>
        <p>Unidades: {formatNumber(row.units)}</p>
        <p>Valor a costo: {formatCOP(row.costValue)}</p>
        <p>Productos con stock: {formatNumber(row.productCount)}</p>
        <p className="text-content-faint pt-1">Clic para filtrar la rotación</p>
      </ChartTooltip>
    )
  }

  return (
    <ReportCard
      title="Inventario por bodega"
      subtitle="¿Dónde está el stock y cuánto capital hay inmovilizado en cada bodega?"
      isLoading={isLoading}
      isError={isError}
      onRetry={() => void refetch()}
      isEmpty={warehouses.length === 0}
      emptyIcon={Warehouse}
      emptyTitle="Sin stock en bodegas"
      emptyDescription="Cuando haya existencias aparecerán aquí por bodega"
      actions={
        <SegmentedToggle
          checked={showValue}
          onChange={setShowValue}
          uncheckedLabel="Unidades"
          checkedLabel="Valor (costo)"
        />
      }
    >
      <div
        role="img"
        aria-label={`Gráfico de barras de ${showValue ? 'valor a costo' : 'unidades'} por bodega`}
        className="h-72 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={warehouses} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={AXIS_TICK}
              tickFormatter={(v: string) => truncate(v, 14)}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={AXIS_TICK}
              tickFormatter={formatCompact}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={renderContent} cursor={{ fill: CHART_COLORS.cursor }} />
            <Bar
              dataKey={metric}
              radius={[6, 6, 0, 0]}
              maxBarSize={56}
              cursor="pointer"
              onClick={(_, index) => {
                const clicked = warehouses[index]
                if (!clicked) return
                onWarehouseSelect(clicked.warehouseId === warehouseId ? null : clicked.warehouseId)
              }}
            >
              {warehouses.map((w) => (
                <Cell
                  key={w.warehouseId}
                  fill={CHART_COLORS.primary}
                  fillOpacity={warehouseId && warehouseId !== w.warehouseId ? 0.25 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-content-faint text-xs mt-2 font-accent">
        Haz clic en una barra para ver la rotación solo de esa bodega.
      </p>
    </ReportCard>
  )
}
