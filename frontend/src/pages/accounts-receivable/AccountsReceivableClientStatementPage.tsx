import { useState } from 'react'
import { useGoBack } from '@/hooks/useGoBack'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ArrowLeft, Wallet, CreditCard, FileText, History, PiggyBank } from 'lucide-react'
import { getClientStatement } from '@/services/accounts-receivable.service'
import { cn } from '@/lib/utils'
import { formatCOP, docNumber, formatBogotaDate } from '@/lib/format'
import { StatusBadge } from './components/StatusBadge'
import { PaymentDaysCell } from './components/PaymentDaysCell'
import { formatDate, DOCUMENT_TYPE_LABELS } from './accounts-receivable.utils'

// Estado de una nota de saldo a favor: solo 'available' | 'used' en el backend.
const CREDIT_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  available: {
    label: 'Disponible',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  },
  used: {
    label: 'Agotado',
    className: 'bg-surface-hover text-content-muted',
  },
}
const creditStatusBadgeFor = (status: string) =>
  CREDIT_STATUS_BADGE[status] ?? {
    label: status,
    className: 'bg-surface-hover text-content-muted',
  }

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
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
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

  const { client, totals, receivables, credits, branchTotals } = statement
  const hasBranches = branchTotals.some((b) => b.branchId !== null)
  const totalDebt = Number(totals.totalDebt)
  const totalPaid = Number(totals.totalPaid)
  const totalBalance = Number(totals.totalBalance)
  const availableCredit = Number(totals.availableCredit)

  return (
    <div className="space-y-6 pb-10">
      {/* Back */}
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      {/* Header card */}
      <div className="card-hard p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 gradient-user">
            {client.name[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h1 className="text-2xl text-content">{client.name}</h1>
            <p className="text-content-muted text-sm mt-1 font-accent">
              Estado de cuenta del cliente
            </p>
          </div>
        </div>

        {/* Totals grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-5 border-t border-ui-divide pt-5">
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
              <p className="text-xs text-content-faint">Saldo a favor disponible</p>
              <p className="text-sm text-content font-medium">{formatCOP(availableCredit)}</p>
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
                  {['Sucursal', 'Deuda', 'Pagado', 'Saldo'].map((h) => (
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
                    'Último pago',
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

      {/* Client credits */}
      <div className="card-hard overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-ui-border-medium">
          <h2 className="text-content font-semibold">Saldos a favor</h2>
          <p className="text-content-muted text-xs mt-0.5 font-accent">
            {credits.length} {credits.length === 1 ? 'nota registrada' : 'notas registradas'}
          </p>
        </div>

        {credits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="w-10 h-10 text-content-faint mb-2" />
            <p className="text-content-muted text-sm">Este cliente no tiene saldos a favor</p>
          </div>
        ) : (
          <div className="divide-y divide-ui-divide">
            {credits.map((credit) => {
              const badge = creditStatusBadgeFor(credit.status)
              return (
                <div key={credit.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                        <PiggyBank className="w-4 h-4 text-content-muted" />
                      </div>
                      <div>
                        <p className="text-sm text-content font-medium">
                          {formatCOP(Number(credit.amount))}{' '}
                          <span className="text-content-faint font-normal">
                            (saldo disponible: {formatCOP(Number(credit.balance))})
                          </span>
                        </p>
                        <p className="text-xs text-content-faint mt-0.5">
                          {credit.sourceDocument
                            ? `Origen: ${docNumber(credit.sourceDocument.type, credit.sourceDocument.number)}`
                            : 'Sin documento de origen'}
                        </p>
                      </div>
                    </div>
                    <span className={cn('pill-stamp whitespace-nowrap', badge.className)}>
                      {badge.label}
                    </span>
                  </div>

                  {credit.applications.length > 0 && (
                    <div className="mt-3 ml-11 space-y-1.5">
                      {credit.applications.map((application) => (
                        <div
                          key={application.id}
                          className="flex items-center gap-2 text-xs text-content-muted"
                        >
                          <span className="text-content-faint">
                            {formatBogotaDate(application.appliedAt)}
                          </span>
                          <span>·</span>
                          <span className="text-content-secondary font-medium">
                            {formatCOP(Number(application.amount))}
                          </span>
                          <span>aplicado en venta</span>
                          <span className="font-mono text-content-secondary">
                            {docNumber(
                              application.saleDocument.type,
                              application.saleDocument.number,
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
