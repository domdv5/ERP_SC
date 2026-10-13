export const CHART_COLORS = {
  primary: 'var(--chart-primary)',
  primarySoft: 'var(--chart-primary-soft)',
  payable: 'var(--chart-payable)',
  warning: 'var(--chart-warning)',
  neutral: 'var(--chart-neutral)',
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  cursor: 'var(--chart-cursor)',
} as const

export const AXIS_TICK = { fill: CHART_COLORS.axis, fontSize: 12 } as const

export const MAX_RANGE_DAYS = 366
const DAY_MS = 24 * 60 * 60 * 1000

export type RangePreset = '7' | '30' | '90' | 'month' | 'custom'

export interface DateRangeValue {
  from: string
  to: string
}

export const PRESET_OPTIONS: { value: Exclude<RangePreset, 'custom'>; label: string }[] = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: 'month', label: 'Este mes' },
]

// Fechas calendario en UTC puro (YYYY-MM-DD) para no correr un día por zona horaria.
export function todayInBogota(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' })
}

function shiftDate(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export function resolvePreset(preset: Exclude<RangePreset, 'custom'>): DateRangeValue {
  const to = todayInBogota()
  if (preset === 'month') return { from: `${to.slice(0, 8)}01`, to }
  return { from: shiftDate(to, -(Number(preset) - 1)), to }
}

export function countRangeDays({ from, to }: DateRangeValue): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1
}

export function getRangeError({ from, to }: DateRangeValue): string | null {
  if (!from || !to) return 'Selecciona fecha inicial y final'
  if (from > to) return 'La fecha inicial no puede ser posterior a la final'
  if (countRangeDays({ from, to }) > MAX_RANGE_DAYS) {
    return `El rango no puede superar ${MAX_RANGE_DAYS} días`
  }
  return null
}

export const DEFAULT_RANGE = { preset: '30' as RangePreset, ...resolvePreset('30') }

const numberFormatter = new Intl.NumberFormat('es-CO')
const compactFormatter = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const formatNumber = (value: number) => numberFormatter.format(value)

export const formatCompact = (value: number) => compactFormatter.format(value)

export function formatShortDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .replace('.', '')
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
