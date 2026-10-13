import { Boxes, Coins, HandCoins, Receipt, Scale, ShoppingBag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/utils'
import { formatNumber } from '../reports.utils'
import type { DateRangeValue } from '../reports.utils'
import {
  useAccountsReport,
  useInventoryReport,
  useSalesBySellerReport,
} from '../hooks/useReportQueries'

interface KpiTileProps {
  icon: LucideIcon
  label: string
  value: string | null
  hint: string
  isLoading: boolean
  tone?: 'default' | 'positive' | 'warning'
}

function KpiTile({ icon: Icon, label, value, hint, isLoading, tone = 'default' }: KpiTileProps) {
  return (
    <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-4 min-w-0">
      <div className="flex items-center gap-2 text-content-muted text-xs">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-brand-secondary/10 shrink-0">
          <Icon className="w-4 h-4 text-brand-secondary" aria-hidden="true" />
        </span>
        <span className="truncate">{label}</span>
      </div>
      {isLoading ? (
        <div className="mt-3 space-y-2 animate-pulse" role="status" aria-label="Cargando">
          <div className="h-6 w-3/4 rounded bg-surface-hover" />
          <div className="h-3 w-1/2 rounded bg-surface-hover" />
        </div>
      ) : (
        <>
          <p
            title={value ?? undefined}
            className={cn(
              'mt-3 text-xl font-semibold truncate tabular-nums',
              tone === 'positive' && 'text-brand-secondary',
              tone === 'warning' && 'text-amber-600 dark:text-amber-400',
              tone === 'default' && 'text-content',
            )}
          >
            {value ?? '—'}
          </p>
          <p className="text-content-faint text-xs mt-1 font-accent truncate">{hint}</p>
        </>
      )}
    </div>
  )
}

export function KpiStrip({ from, to }: DateRangeValue) {
  const inventory = useInventoryReport()
  const accounts = useAccountsReport()
  const sales = useSalesBySellerReport({ from, to })

  const netPosition = accounts.data
    ? accounts.data.receivable.balance - accounts.data.payable.balance
    : null
  // Incluye ventas y devoluciones sin vendedora, igual que la tendencia diaria.
  const netSales = sales.data
    ? sales.data.sellers.reduce((sum, s) => sum + s.netSales, 0) +
      sales.data.unassignedSales -
      sales.data.unassignedReturns
    : null

  const openCountHint = (count: number | undefined) =>
    count === undefined ? 'Sin datos' : `${formatNumber(count)} cuentas abiertas`

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiTile
        icon={Coins}
        label="Valor del inventario"
        value={inventory.data ? formatCOP(inventory.data.totals.costValue) : null}
        hint="A costo promedio"
        isLoading={inventory.isLoading}
      />
      <KpiTile
        icon={Boxes}
        label="Unidades en stock"
        value={inventory.data ? formatNumber(inventory.data.totals.units) : null}
        hint={
          inventory.data
            ? `${formatNumber(inventory.data.totals.productCount)} productos`
            : 'Todas las bodegas'
        }
        isLoading={inventory.isLoading}
      />
      <KpiTile
        icon={Receipt}
        label="Saldo por pagar"
        value={accounts.data ? formatCOP(accounts.data.payable.balance) : null}
        hint={openCountHint(accounts.data?.payable.openCount)}
        isLoading={accounts.isLoading}
      />
      <KpiTile
        icon={HandCoins}
        label="Saldo por cobrar"
        value={accounts.data ? formatCOP(accounts.data.receivable.balance) : null}
        hint={openCountHint(accounts.data?.receivable.openCount)}
        isLoading={accounts.isLoading}
      />
      <KpiTile
        icon={Scale}
        label="Posición neta"
        value={netPosition === null ? null : formatCOP(netPosition)}
        hint="Por cobrar − por pagar"
        isLoading={accounts.isLoading}
        tone={netPosition === null ? 'default' : netPosition >= 0 ? 'positive' : 'warning'}
      />
      <KpiTile
        icon={ShoppingBag}
        label="Ventas netas"
        value={netSales === null ? null : formatCOP(netSales)}
        hint="Ventas − devoluciones del período"
        isLoading={sales.isLoading}
      />
    </div>
  )
}
