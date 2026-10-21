import { CalendarRange, Warehouse as WarehouseIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WarehouseStockRow } from '@/types/reports.types'
import {
  PRESET_OPTIONS,
  getRangeError,
  resolvePreset,
  type DateRangeValue,
  type RangePreset,
} from '../reports.utils'

export interface RangeDraft extends DateRangeValue {
  preset: RangePreset
}

interface ReportFiltersProps {
  range: RangeDraft
  onRangeChange: (next: RangeDraft) => void
  warehouseId: string | null
  warehouses: WarehouseStockRow[]
  onWarehouseChange: (warehouseId: string | null) => void
}

const DATE_INPUT_CLASS = 'input-hard px-2.5 py-1.5 text-sm'

export function ReportFilters({
  range,
  onRangeChange,
  warehouseId,
  warehouses,
  onWarehouseChange,
}: ReportFiltersProps) {
  const rangeError = getRangeError(range)

  return (
    <div className="card-hard p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarRange className="w-4 h-4 text-content-faint" aria-hidden="true" />
          <div
            role="group"
            aria-label="Período"
            className="inline-flex items-center gap-1 p-1 rounded-md bg-surface-raised border-2 border-ui-border-medium"
          >
            {PRESET_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={range.preset === option.value}
                onClick={() =>
                  onRangeChange({ preset: option.value, ...resolvePreset(option.value) })
                }
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
              onChange={(e) => onRangeChange({ ...range, preset: 'custom', from: e.target.value })}
              className={DATE_INPUT_CLASS}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-content-muted">
            Hasta
            <input
              type="date"
              value={range.to}
              min={range.from || undefined}
              onChange={(e) => onRangeChange({ ...range, preset: 'custom', to: e.target.value })}
              className={DATE_INPUT_CLASS}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <WarehouseIcon className="w-4 h-4 text-content-faint" aria-hidden="true" />
          <label className="flex items-center gap-1.5 text-xs text-content-muted">
            Bodega (rotación)
            <select
              value={warehouseId ?? ''}
              onChange={(e) => onWarehouseChange(e.target.value || null)}
              className={DATE_INPUT_CLASS}
            >
              <option value="">Todas las bodegas</option>
              {warehouses.map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          {warehouseId && (
            <button
              type="button"
              onClick={() => onWarehouseChange(null)}
              aria-label="Quitar filtro de bodega"
              className="p-1.5 rounded-lg text-content-muted hover:text-brand-secondary hover:bg-brand-secondary/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {rangeError && (
        <p role="alert" className="text-xs text-amber-600 dark:text-amber-400">
          {rangeError}. Se mantiene el último período válido.
        </p>
      )}
    </div>
  )
}
