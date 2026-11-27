import { useState } from 'react'
import { useGoBack } from '@/hooks/useGoBack'
import { BackLink } from '@/components/shared'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Wallet, CreditCard, FileText, PiggyBank } from 'lucide-react'
import { getClientStatement } from '@/services/accounts-receivable.service'
import { cn } from '@/lib/utils'
import { formatCOP, docNumber } from '@/lib/format'
import { StatusBadge } from './components/StatusBadge'
import { PaymentDaysCell } from './components/PaymentDaysCell'
import { formatDate, DOCUMENT_TYPE_LABELS } from './accounts-receivable.utils'

export default function AccountsReceivableClientStatementPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const goBack = useGoBack('/accounts-receivable')
  const [branchId, setBranchId] = useState('')

  const {
    data: statement,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['accounts-receivable', 'clients', clientId, 'statement', branchId],
    queryFn: () => getClientStatement(clientId!, branchId || undefined),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(clientId),
  })

  // ── loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-hover animate-pulse" />
          <div className="w-48 h-7 rounded-lg bg-surface-hover animate-pulse" />
        </div>
        <div className="card-hard p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-6 rounded-lg bg-surface-hover animate-pulse"
              style={{ width: `${60 + i * 10}%` }}
            />
          ))}
        </div>
        <div className="card-hard p-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-hover animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !statement) {
    return (
      <div className="space-y-4">
        <BackLink onBack={goBack} />
        <div className="card-hard p-8 text-center">
          <Wallet className="w-12 h-12 text-content-faint mx-auto mb-3" />
          <p className="text-content-secondary mb-3">Error al cargar el estado de cuenta</p>
          <button onClick={() => refetch()} className="text-sm link-plain">
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const { client, totals, receivables, branchTotals } = statement
  const hasBranches = branchTotals.some((b) => b.branchId !== null)
  const totalDebt = Number(totals.totalDebt)
  const totalPaid = Number(totals.totalPaid)
  const totalBalance = Number(totals.totalBalance)
  const availableCredit = Number(totals.availableCredit)
  const availableBranchCredit = Number(totals.availableBranchCredit)

  return (
    <div className="space-y-6 pb-10">
      {/* Back */}
      <BackLink onBack={goBack} />

      {/* Header card */}
      <div className="card-hard p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 gradient-user">
            {client.name[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl text-content">{client.name}</h1>
            <p className="text-content-muted text-sm mt-1 font-accent">
              Estado de cuenta del cliente
            </p>
          </div>
        </div>

        {/* Totals grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 border-t border-ui-divide pt-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Deuda total</p>
              <p className="text-sm text-content font-medium">{formatCOP(totalDebt)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Pagado</p>
              <p className="text-sm text-content font-medium">{formatCOP(totalPaid)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Saldo</p>
              <p
                className={cn(
                  'text-sm font-medium',
                  totalBalance > 0 ? 'text-content' : 'text-brand-secondary',
                )}
              >
                {formatCOP(totalBalance)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <PiggyBank className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Saldo a favor (devoluciones)</p>
              <p className="text-sm text-content font-medium">{formatCOP(availableCredit)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <PiggyBank className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Saldo a favor de administración</p>
              <p className="text-sm text-content font-medium">{formatCOP(availableBranchCredit)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen por sucursal */}
      {hasBranches && (
        <div className="card-hard overflow-hidden">
          <div className="px-6 py-4 border-b-2 border-ui-border-medium">
            <h2 className="text-content font-semibold">Resumen por sucursal</h2>
            <p className="text-content-muted text-xs mt-0.5 font-accent">
              Suma de todas las cuentas del cliente, sin importar el filtro
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-ui-border-medium">
                  {['Sucursal', 'Deuda', 'Pagado', 'Saldo', 'Saldo a favor (administración)'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {branchTotals.map((branch) => (
                  <tr key={branch.branchId ?? 'none'}>
                    <td className="px-5 py-3.5 text-content font-medium">{branch.name}</td>
                    <td className="px-5 py-3.5 text-content-secondary text-xs whitespace-nowrap">
                      {formatCOP(Number(branch.totalDebt))}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatCOP(Number(branch.totalPaid))}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(branch.totalBalance))}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatCOP(Number(branch.availableBranchCredit))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receivables table */}
      <div className="card-hard overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-border flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-content font-semibold">Cuentas por cobrar</h2>
            <p className="text-content-muted text-xs mt-0.5 font-accent">
              {receivables.length} {receivables.length === 1 ? 'documento' : 'documentos'}
            </p>
          </div>
          {hasBranches && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="input-hard text-sm px-3 py-1.5"
            >
              <option value="">Todas las sucursales</option>
              {branchTotals
                .filter((b) => b.branchId !== null)
                .map((b) => (
                  <option key={b.branchId} value={b.branchId!}>
                    {b.name}
                  </option>
                ))}
            </select>
          )}
        </div>

        {receivables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="w-10 h-10 text-content-faint mb-2" />
            <p className="text-content-muted text-sm">Este cliente no tiene cuentas por cobrar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-ui-border-medium">
                  {[
                    'Documento',
                    ...(hasBranches ? ['Sucursal'] : []),
                    'Fecha',
                    'Total',
                    'Pagado',
                    'Saldo',
                    'Último cobro',
                    'Días',
                    'Estado',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-semibold text-content-faint uppercase tracking-wider px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-divide">
                {receivables.map((receivable) => (
                  <tr
                    key={receivable.id}
                    onClick={() => navigate(`/accounts-receivable/${receivable.id}`)}
                    className="hover:bg-surface-raised transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-medium text-content">
                          {docNumber(receivable.document.type, receivable.document.number)}
                        </span>
                        <span className="text-xs text-content-faint">
                          {DOCUMENT_TYPE_LABELS[receivable.document.type] ??
                            receivable.document.type}
                        </span>
                      </div>
                    </td>
                    {hasBranches && (
                      <td className="px-5 py-3.5 text-content-muted text-xs">
                        {receivable.document.customerBranch?.name ?? '—'}
                      </td>
                    )}
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatDate(receivable.document.date)}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(receivable.totalAmount))}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatCOP(Number(receivable.paidAmount))}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(receivable.balance))}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatDate(receivable.lastPaymentDate)}
                    </td>
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                      <PaymentDaysCell
                        days={receivable.paymentDays}
                        isOpen={receivable.isPaymentOpen}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={receivable.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
