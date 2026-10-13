import { useState } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { ReportFilters, type RangeDraft } from './components/ReportFilters'
import { KpiStrip } from './components/KpiStrip'
import { InventorySection } from './components/InventorySection'
import { RotationSection } from './components/RotationSection'
import { AccountsSection } from './components/AccountsSection'
import { SalesSection } from './components/SalesSection'
import { useInventoryReport } from './hooks/useReportQueries'
import { DEFAULT_RANGE, getRangeError, type DateRangeValue } from './reports.utils'

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pt-2">
      <h2 className="text-content text-lg">{title}</h2>
      <p className="text-content-muted text-sm font-accent">{subtitle}</p>
    </div>
  )
}

export default function ReportsPage() {
  const [draft, setDraft] = useState<RangeDraft>(DEFAULT_RANGE)
  // Solo se consulta con rangos válidos: un borrador incompleto no dispara requests.
  const [applied, setApplied] = useState<DateRangeValue>({
    from: DEFAULT_RANGE.from,
    to: DEFAULT_RANGE.to,
  })
  const [warehouseId, setWarehouseId] = useState<string | null>(null)

  const { data: inventory } = useInventoryReport()
  const warehouses = inventory?.warehouses ?? []
  const warehouseName = warehouses.find((w) => w.warehouseId === warehouseId)?.name ?? null

  const queryClient = useQueryClient()
  const isRefreshing = useIsFetching({ queryKey: ['reports'] }) > 0
  const lastUpdatedAt = Math.max(
    0,
    ...queryClient
      .getQueryCache()
      .findAll({ queryKey: ['reports'], type: 'active' })
      .map((query) => query.state.dataUpdatedAt),
  )

  const handleRefresh = () => {
    void queryClient.refetchQueries({ queryKey: ['reports'], type: 'active' })
  }

  const handleRangeChange = (next: RangeDraft) => {
    setDraft(next)
    if (!getRangeError(next)) setApplied({ from: next.from, to: next.to })
  }

  return (
    <div className="space-y-5 max-w-[1600px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-2xl">Informes</h1>
          <p className="text-content-muted text-sm font-accent">
            Inventario, rotación, cartera y ventas en un solo lugar.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lastUpdatedAt > 0 && (
            <span className="text-content-muted text-xs font-accent hidden sm:inline">
              Actualizado{' '}
              {new Date(lastUpdatedAt).toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Actualizar informes"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      <ReportFilters
        range={draft}
        onRangeChange={handleRangeChange}
        warehouseId={warehouseId}
        warehouses={warehouses}
        onWarehouseChange={setWarehouseId}
      />

      <KpiStrip from={applied.from} to={applied.to} />

      <SectionTitle
        title="Inventario"
        subtitle="Estado actual de existencias, sin importar el período."
      />
      <InventorySection warehouseId={warehouseId} onWarehouseSelect={setWarehouseId} />
      <RotationSection
        from={applied.from}
        to={applied.to}
        warehouseId={warehouseId}
        warehouseName={warehouseName}
      />

      <SectionTitle title="Estado de cuenta" subtitle="Saldos abiertos al día de hoy." />
      <AccountsSection />

      <SectionTitle title="Ventas" subtitle="Ventas netas del período seleccionado." />
      <SalesSection from={applied.from} to={applied.to} />
    </div>
  )
}
