import type { ReactNode } from 'react'
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
import { AXIS_TICK, CHART_COLORS, formatCompact, truncate } from '../reports.utils'

const ROW_HEIGHT = 34
const CHART_PADDING = 40

interface HorizontalBarChartProps<T extends object> {
  data: T[]
  getLabel: (row: T) => string
  getValue: (row: T) => number
  // Color por fila; por defecto la serie principal.
  getColor?: (row: T) => string
  renderTooltip: (row: T) => ReactNode
  onBarClick?: (row: T) => void
  ariaLabel: string
  formatTick?: (value: number) => string
  labelWidth?: number
}

export function ChartTooltip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ui-border-medium bg-surface px-3 py-2 shadow-md text-xs text-content-secondary space-y-0.5 max-w-64">
      {children}
    </div>
  )
}

export function HorizontalBarChart<T extends object>({
  data,
  getLabel,
  getValue,
  getColor,
  renderTooltip,
  onBarClick,
  ariaLabel,
  formatTick = formatCompact,
  labelWidth = 120,
}: HorizontalBarChartProps<T>) {
  const rows = data.map((row) => ({ row, label: getLabel(row), value: getValue(row) }))
  const clickable = Boolean(onBarClick)

  const renderContent = ({ active, payload }: TooltipContentProps) => {
    if (!active || !payload?.length) return null
    const row: T | undefined = payload[0]?.payload?.row
    return row ? <ChartTooltip>{renderTooltip(row)}</ChartTooltip> : null
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{ height: rows.length * ROW_HEIGHT + CHART_PADDING }}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickFormatter={formatTick}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            tick={AXIS_TICK}
            tickFormatter={(v: string) => truncate(v, Math.floor(labelWidth / 7))}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip content={renderContent} cursor={{ fill: CHART_COLORS.cursor }} />
          <Bar
            dataKey="value"
            radius={[0, 6, 6, 0]}
            maxBarSize={20}
            cursor={clickable ? 'pointer' : undefined}
            onClick={(_, index) => {
              const entry = rows[index]
              if (entry) onBarClick?.(entry.row)
            }}
          >
            {rows.map((r, index) => (
              <Cell key={index} fill={getColor ? getColor(r.row) : CHART_COLORS.primary} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
