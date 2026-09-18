import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Wallet, CreditCard, FileText, History, Landmark, PiggyBank } from 'lucide-react'
import { getSupplierStatement } from '@/services/accounts-payable.service'
import { cn } from '@/lib/utils'
import { formatCOP, docNumber } from '@/lib/format'
import { StatusBadge } from './components/StatusBadge'
import { formatDate, DOCUMENT_TYPE_LABELS } from './accounts-payable.utils'

// Estado de una nota de saldo a favor: solo 'available' | 'used' en el backend.
const CREDIT_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  available: {
    label: 'Disponible',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  },
  used: {
    label: 'Agotado',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
  },
}
const creditStatusBadgeFor = (status: string) =>
  CREDIT_STATUS_BADGE[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
  }

export default function AccountsPayableSupplierStatementPage() {
  const { supplierId } = useParams<{ supplierId: string }>()
  const navigate = useNavigate()

  const {
    data: statement,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['accounts-payable', 'suppliers', supplierId, 'statement'],
    queryFn: () => getSupplierStatement(supplierId!),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(supplierId),
  })

  // ── loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-hover animate-pulse" />
          <div className="w-48 h-7 rounded-lg bg-surface-hover animate-pulse" />
        </div>
        <div className="bg-surface rounded-2xl border border-ui-border p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-6 rounded-lg bg-surface-hover animate-pulse"
              style={{ width: `${60 + i * 10}%` }}
            />
          ))}
        </div>
        <div className="bg-surface rounded-2xl border border-ui-border p-6 space-y-3">
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
          onClick={() => navigate('/accounts-payable')}
          className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a cuentas por pagar
        </button>
        <div className="bg-surface rounded-2xl border border-ui-border p-8 text-center">
          <Wallet className="w-12 h-12 text-content-faint mx-auto mb-3" />
          <p className="text-content-secondary mb-3">Error al cargar el estado de cuenta</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-brand-secondary hover:underline"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const { supplier, totals, payables, credits } = statement
  const totalDebt = Number(totals.totalDebt)
  const totalPaid = Number(totals.totalPaid)
  const totalBalance = Number(totals.totalBalance)
  const availableCredit = Number(totals.availableCredit)

  return (
    <div className="space-y-6 pb-10">
      {/* Back */}
      <button
        onClick={() => navigate('/accounts-payable')}
        className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a cuentas por pagar
      </button>

      {/* Header card */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 gradient-user">
            {supplier.name[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h1 className="text-2xl text-content">{supplier.name}</h1>
            <p className="text-content-muted text-sm mt-1 font-accent">
              Estado de cuenta del proveedor
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
              <p className="text-xs text-content-faint">Total debido</p>
              <p className="text-sm text-content font-medium">{formatCOP(totalDebt)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Total pagado</p>
              <p className="text-sm text-content font-medium">{formatCOP(totalPaid)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Saldo pendiente</p>
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

      {/* Payables table */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-border">
          <h2 className="text-content font-semibold">Cuentas por pagar</h2>
          <p className="text-content-muted text-xs mt-0.5 font-accent">
            {payables.length} {payables.length === 1 ? 'documento' : 'documentos'}
          </p>
        </div>

        {payables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="w-10 h-10 text-content-faint mb-2" />
            <p className="text-content-muted text-sm">Este proveedor no tiene cuentas por pagar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Documento', 'Fecha', 'Total', 'Pagado', 'Saldo', 'Estado'].map((h) => (
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
                {payables.map((payable) => (
                  <tr
                    key={payable.id}
                    onClick={() => navigate(`/accounts-payable/${payable.id}`)}
                    className="hover:bg-surface-raised transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-medium text-content">
                          {docNumber(payable.document.type, payable.document.number)}
                        </span>
                        <span className="text-xs text-content-faint">
                          {DOCUMENT_TYPE_LABELS[payable.document.type] ?? payable.document.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatDate(payable.document.date)}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(payable.totalAmount))}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatCOP(Number(payable.paidAmount))}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(payable.balance))}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={payable.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supplier credits */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-border">
          <h2 className="text-content font-semibold">Saldos a favor</h2>
          <p className="text-content-muted text-xs mt-0.5 font-accent">
            {credits.length} {credits.length === 1 ? 'nota registrada' : 'notas registradas'}
          </p>
        </div>

        {credits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="w-10 h-10 text-content-faint mb-2" />
            <p className="text-content-muted text-sm">Este proveedor no tiene saldos a favor</p>
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
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                        badge.className,
                      )}
                    >
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
                            {formatDate(application.appliedAt)}
                          </span>
                          <span>·</span>
                          <span className="text-content-secondary font-medium">
                            {formatCOP(Number(application.amount))}
                          </span>
                          <span>aplicado a</span>
                          {application.egreso ? (
                            <button
                              onClick={() => navigate(`/egresos/${application.egreso!.id}`)}
                              className="flex items-center gap-1 text-brand-secondary hover:underline"
                            >
                              <Landmark className="w-3 h-3" />
                              {docNumber('EG', application.egreso.number)}
                            </button>
                          ) : (
                            <span className="text-content-faint">(aplicación histórica)</span>
                          )}
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
