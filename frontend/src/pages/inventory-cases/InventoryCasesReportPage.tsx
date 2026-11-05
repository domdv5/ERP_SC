import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { CalendarRange, ClipboardList } from 'lucide-react'
import { getInventoryCaseReport } from '@/services/inventory-cases.service'
import { EmptyState, ErrorState } from '@/components/shared'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  DEFAULT_RANGE,
  PRESET_OPTIONS,
  getRangeError,
  resolvePreset,
} from '@/pages/reports/reports.utils'
import type { InventoryCaseReport } from '@/types/inventory-case.types'
import { InventoryCasesTabs } from './components/InventoryCasesTabs'
import { getCauseLabel } from './inventory-cases.constants'
import { useCaseWarehouses } from './useCaseWarehouses'

const FILTER_INPUT_CLASS = 'input-hard px-2.5 py-1.5 text-sm'

const formatUnits = (n: number) => n.toLocaleString('es-CO')
const formatPercent = (part: number, whole: number) =>
  whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`

function TotalCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card-hard p-4">
      <p className="font-mono text-[11px] uppercase tracking-wider text-content-muted">{label}</p>
      <p className="mt-1.5 font-display font-black text-3xl leading-none text-content tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-content-muted">{hint}</p>
    </div>
  )
}

function BarRow({
  label,
  value,
  max,
  right,
}: {
  label: string
  value: number
  max: number
  right: React.ReactNode
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-3 text-sm">
      <span className="text-content truncate" title={label}>
        {label}
      </span>
      <span className="h-3 bg-surface-hover border border-ui-border-medium rounded-sm overflow-hidden">
        <span
          className="block h-full bg-brand-secondary"
          style={{ width: `${max === 0 ? 0 : (value / max) * 100}%` }}
        />
      </span>
      <span className="text-right text-content-secondary tabular-nums">{right}</span>
    </li>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card-hard h-24 bg-surface-hover" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-hard h-72 bg-surface-hover" />
        <div className="card-hard h-72 bg-surface-hover" />
      </div>
      <div className="card-hard h-64 bg-surface-hover" />
    </div>
  )
}

function ReportContent({ report }: { report: InventoryCaseReport }) {
  const { totals, byCause, byWarehouse, topProducts } = report
  const maxCause = Math.max(0, ...byCause.map((row) => row.count))
  const maxWarehouse = Math.max(0, ...byWarehouse.map((row) => row.count))

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <TotalCard
          label="Casos"
          value={formatUnits(totals.cases)}
          hint={`${formatUnits(totals.closed)} cerrados · ${formatUnits(totals.open)} abiertos`}
        />
        <TotalCard
          label="Unidades ajustadas"
          value={formatUnits(totals.units)}
          hint="Entradas por «negativo»"
        />
        <TotalCard
          label="Costo aproximado"
          value={formatCOP(totals.approxCost)}
          hint="Unidades ajustadas a su costo"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-hard p-5 space-y-3" aria-labelledby="causes-title">
          <div>
            <h2 id="causes-title" className="text-lg text-content">
              Causas más frecuentes
            </h2>
            <p className="text-xs text-content-muted font-accent">
              Casos cerrados por causa · % sobre {formatUnits(totals.closed)} cerrados
            </p>
          </div>
          {byCause.length === 0 ? (
            <p className="text-sm text-content-muted">Aún no hay casos cerrados en este periodo.</p>
          ) : (
            <ol className="space-y-2.5">
              {byCause.map((row) => (
                <BarRow
                  key={row.cause}
                  label={getCauseLabel(row.cause)}
                  value={row.count}
                  max={maxCause}
                  right={
                    <>
                      <b className="text-content">{row.count}</b>{' '}
                      <span className="text-xs text-content-muted">
                        {formatPercent(row.count, totals.closed)}
                      </span>
                    </>
                  }
                />
              ))}
            </ol>
          )}
          {totals.open > 0 && (
            <p className="text-xs text-content-muted border-t-2 border-ui-border pt-2">
              Sin causa aún (abiertos): <b className="text-content">{formatUnits(totals.open)}</b>
            </p>
          )}
        </section>

        <section className="card-hard p-5 space-y-3" aria-labelledby="warehouses-title">
          <div>
            <h2 id="warehouses-title" className="text-lg text-content">
              Casos por bodega
            </h2>
            <p className="text-xs text-content-muted font-accent">
              Cantidad de casos y costo de lo ajustado
            </p>
          </div>
          {byWarehouse.length === 0 ? (
            <p className="text-sm text-content-muted">Sin casos en este periodo.</p>
          ) : (
            <ol className="space-y-2.5">
              {byWarehouse.map((row) => (
                <BarRow
                  key={row.warehouseId}
                  label={row.name}
                  value={row.count}
                  max={maxWarehouse}
                  right={
                    <>
                      <b className="text-content">{row.count}</b>{' '}
                      <span className="text-xs text-content-muted">
                        {formatCOP(row.approxCost)}
                      </span>
                    </>
                  }
                />
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="card-hard overflow-hidden" aria-labelledby="products-title">
        <div className="px-5 py-4 border-b-2 border-ui-border-medium">
          <h2 id="products-title" className="text-lg text-content">
            Productos con más casos
          </h2>
        </div>
        {topProducts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-content-muted">Sin casos en este periodo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Producto', 'Casos', 'Unidades', 'Costo aprox.', 'Causa principal'].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={cn(
                          'text-xs font-semibold text-content-faint uppercase tracking-wider px-4 py-3',
                          i === 0 || i === 4 ? 'text-left' : 'text-right',
                        )}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {topProducts.map((row) => (
                  <tr key={row.productId}>
                    <td className="px-4 py-3 text-content">
                      <span className="font-mono text-xs font-semibold">{row.code}</span>{' '}
                      <span className="text-content-secondary">{row.description}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-content">{row.count}</td>
                    <td className="px-4 py-3 text-right text-content-secondary">
                      {formatUnits(row.units)}
                    </td>
                    <td className="px-4 py-3 text-right text-content-secondary">
                      {formatCOP(row.approxCost)}
                    </td>
                    <td className="px-4 py-3 text-content-secondary">
                      {row.mostCommonCause ? getCauseLabel(row.mostCommonCause) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export default function InventoryCasesReportPage() {
  const { warehouses } = useCaseWarehouses()
  const [range, setRange] = useState(DEFAULT_RANGE)
  const [warehouseId, setWarehouseId] = useState('')

  const rangeError = getRangeError(range)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory-cases', 'report', range.from, range.to, warehouseId],
    queryFn: () =>
      getInventoryCaseReport({
        from: range.from,
        to: range.to,
        warehouseId: warehouseId || undefined,
      }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    enabled: !rangeError,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-content">Diferencias de inventario</h1>
        <p className="text-sm text-content-muted font-accent mt-1">
          Por qué falta stock: las causas que se repiten, dónde y con qué productos.
        </p>
      </div>

      <InventoryCasesTabs />

      <div className="card-hard p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarRange className="w-4 h-4 text-content-faint" aria-hidden="true" />
            <div
              role="group"
              aria-label="Periodo"
              className="inline-flex items-center gap-1 p-1 rounded-md bg-surface-raised border-2 border-ui-border-medium"
            >
              {PRESET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={range.preset === option.value}
                  onClick={() => setRange({ preset: option.value, ...resolvePreset(option.value) })}
                  className={cn(
                    'px-3 py-1.5 rounded-sm border-2 text-sm font-medium transition-colors',
                    range.preset === option.value
                      ? 'font-semibold selected-ink'
                      : 'border-transparent text-content-muted hover:text-content',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-content-muted">
              Desde
              <input
                type="date"
                value={range.from}
                max={range.to || undefined}
                onChange={(e) => setRange({ ...range, preset: 'custom', from: e.target.value })}
                className={FILTER_INPUT_CLASS}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-content-muted">
              Hasta
              <input
                type="date"
                value={range.to}
                min={range.from || undefined}
                onChange={(e) => setRange({ ...range, preset: 'custom', to: e.target.value })}
                className={FILTER_INPUT_CLASS}
              />
            </label>
          </div>

          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            aria-label="Bodega"
            className={FILTER_INPUT_CLASS}
          >
            <option value="">Todas las bodegas</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        {rangeError && (
          <p role="alert" className="text-xs text-red-500">
            {rangeError}
          </p>
        )}
      </div>

      {isError && !rangeError && (
        <div className="card-hard">
          <ErrorState message="Error al cargar el informe" onRetry={refetch} />
        </div>
      )}

      {isLoading && !rangeError && <ReportSkeleton />}

      {!rangeError && data && data.totals.cases === 0 && (
        <div className="card-hard">
          <EmptyState
            icon={ClipboardList}
            title="Sin casos en este periodo"
            description="Prueba con otro rango de fechas o bodega"
          />
        </div>
      )}

      {!rangeError && data && data.totals.cases > 0 && <ReportContent report={data} />}
    </div>
  )
}
