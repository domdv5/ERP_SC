import { Scale, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { formatCOP } from '@/lib/format'
import type { AccountTotals, ThirdPartyBalanceRow } from '@/types/reports.types'
import { CHART_COLORS, formatCompact, formatNumber } from '../reports.utils'
import { useAccountsReport } from '../hooks/useReportQueries'
import { ReportCard } from './ReportCard'
import { HorizontalBarChart } from './HorizontalBarChart'

interface BalancePanelProps {
  label: string
  paidLabel: string
  totals: AccountTotals
  color: string
}

function BalancePanel({ label, paidLabel, totals, color }: BalancePanelProps) {
  const paidPercent = totals.total > 0 ? Math.min(100, (totals.paid / totals.total) * 100) : 0

  return (
    <div className="rounded-xl border border-ui-border bg-surface-raised p-4 min-w-0">
      <p className="text-content-muted text-xs">{label}</p>
      <p className="text-content text-2xl font-display mt-1 truncate tabular-nums">
        {formatCOP(totals.balance)}
      </p>
      <div
        role="progressbar"
        aria-label={`${paidLabel}: ${Math.round(paidPercent)}%`}
        aria-valuenow={Math.round(paidPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-3 h-2 rounded-full bg-surface-hover overflow-hidden"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${paidPercent}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between gap-2 mt-2 text-xs text-content-muted">
        <span>
          {paidLabel} {formatCOP(totals.paid)} ({Math.round(paidPercent)}%)
        </span>
        <span className="shrink-0">{formatNumber(totals.openCount)} abiertas</span>
      </div>
    </div>
  )
}

export function AccountsSection() {
  const navigate = useNavigate()
  const canOpenSupplier = useAuthStore((s) => s.hasPermission('ap.read'))
  const canOpenClient = useAuthStore((s) => s.hasPermission('ar.read'))
  const { data, isLoading, isError, refetch } = useAccountsReport()

  const renderBalanceTooltip = (row: ThirdPartyBalanceRow) => (
    <>
      <p className="text-content font-semibold">{row.name}</p>
      <p>Saldo: {formatCOP(row.balance)}</p>
    </>
  )

  const retry = () => void refetch()

  return (
    <div className="space-y-4">
      <ReportCard
        title="Estado de cuenta"
        subtitle="¿Cuánto debemos y cuánto nos deben, y cuánto de eso ya está saldado?"
        isLoading={isLoading}
        isError={isError}
        onRetry={retry}
        isEmpty={!data}
        emptyIcon={Scale}
        emptyTitle="Sin cuentas registradas"
        emptyDescription="Aquí verás el saldo por pagar y por cobrar"
      >
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <BalancePanel
              label="Por pagar (proveedores)"
              paidLabel="Pagado"
              totals={data.payable}
              color={CHART_COLORS.payable}
            />
            <BalancePanel
              label="Por cobrar (clientes)"
              paidLabel="Cobrado"
              totals={data.receivable}
              color={CHART_COLORS.primary}
            />
          </div>
        )}
      </ReportCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ReportCard
          title="Proveedores con mayor saldo"
          subtitle={
            canOpenSupplier
              ? '¿A quién le debemos más? Clic en una barra abre su estado de cuenta.'
              : '¿A quién le debemos más?'
          }
          isLoading={isLoading}
          isError={isError}
          onRetry={retry}
          isEmpty={(data?.topSuppliers.length ?? 0) === 0}
          emptyIcon={Users}
          emptyTitle="Sin saldos por pagar"
          emptyDescription="No hay deudas abiertas con proveedores"
        >
          <HorizontalBarChart
            data={data?.topSuppliers ?? []}
            getLabel={(row) => row.name}
            getValue={(row) => row.balance}
            getColor={() => CHART_COLORS.payable}
            renderTooltip={renderBalanceTooltip}
            onBarClick={
              canOpenSupplier
                ? (row) => navigate(`/accounts-payable/suppliers/${row.thirdPartyId}`)
                : undefined
            }
            ariaLabel="Gráfico de barras con los proveedores de mayor saldo por pagar"
            formatTick={formatCompact}
            labelWidth={140}
          />
        </ReportCard>

        <ReportCard
          title="Clientes con mayor saldo"
          subtitle={
            canOpenClient
              ? '¿Quién nos debe más? Clic en una barra abre su estado de cuenta.'
              : '¿Quién nos debe más? Es donde conviene priorizar el cobro.'
          }
          isLoading={isLoading}
          isError={isError}
          onRetry={retry}
          isEmpty={(data?.topCustomers.length ?? 0) === 0}
          emptyIcon={Users}
          emptyTitle="Sin saldos por cobrar"
          emptyDescription="No hay cartera abierta con clientes"
        >
          <HorizontalBarChart
            data={data?.topCustomers ?? []}
            getLabel={(row) => row.name}
            getValue={(row) => row.balance}
            renderTooltip={renderBalanceTooltip}
            onBarClick={
              canOpenClient
                ? (row) => navigate(`/accounts-receivable/clients/${row.thirdPartyId}`)
                : undefined
            }
            ariaLabel="Gráfico de barras con los clientes de mayor saldo por cobrar"
            formatTick={formatCompact}
            labelWidth={140}
          />
        </ReportCard>
      </div>
    </div>
  )
}
