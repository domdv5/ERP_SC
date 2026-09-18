import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Wallet,
  Calendar,
  FileText,
  CreditCard,
  Landmark,
  Hash,
  Receipt,
  History,
} from 'lucide-react'
import { getAccountPayable } from '@/services/accounts-payable.service'
import { cn } from '@/lib/utils'
import { formatCOP, docNumber } from '@/lib/format'
import { StatusBadge } from './components/StatusBadge'
import { formatDate, DOCUMENT_TYPE_LABELS } from './accounts-payable.utils'
import type { AccountsPayableHistoryEntry } from '@/types'

// Distingue de un vistazo si cada fila del historial es un pago moderno (Egresos),
// un pago registrado antes del rework, o una nota crédito aplicada a mano en esa misma época.
const ORIGIN_BADGE: Record<
  AccountsPayableHistoryEntry['source'],
  { label: string; className: string }
> = {
  egreso: {
    label: 'Egreso',
    className: 'bg-brand-secondary/10 text-brand-secondary',
  },
  pago_historico: {
    label: 'Pago histórico',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  },
  nota_credito_historica: {
    label: 'Nota crédito histórica',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  },
}

export default function AccountsPayableDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: account,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['accounts-payable', id],
    queryFn: () => getAccountPayable(id!),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(id),
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

  if (isError || !account) {
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
          <p className="text-content-secondary mb-3">Error al cargar la cuenta por pagar</p>
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

  const totalAmount = Number(account.totalAmount)
  const paidAmount = Number(account.paidAmount)
  const creditApplied = Number(account.creditApplied)
  const balance = Number(account.balance)
  const history = account.history

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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 gradient-user">
              {account.supplier.thirdParty.name[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl text-content">{account.supplier.thirdParty.name}</h1>
                <StatusBadge status={account.status} />
              </div>
              <p className="text-content-muted text-sm mt-1 font-accent">
                Documento {docNumber(account.document.type, account.document.number)} &middot;{' '}
                {DOCUMENT_TYPE_LABELS[account.document.type] ?? account.document.type}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate(`/accounts-payable/suppliers/${account.supplier.id}`)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-secondary hover:underline shrink-0"
          >
            <Receipt className="w-4 h-4" />
            Ver estado de cuenta del proveedor
          </button>
        </div>

        {/* Meta grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5 border-t border-ui-divide pt-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Monto total</p>
              <p className="text-sm text-content font-medium">{formatCOP(totalAmount)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Pagado</p>
              <p className="text-sm text-content font-medium">{formatCOP(paidAmount)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <History className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Saldo a favor aplicado</p>
              <p className="text-sm text-content font-medium">{formatCOP(creditApplied)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Vencimiento</p>
              <p className="text-sm text-content font-medium">{formatDate(account.dueDate)}</p>
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
                  balance > 0 ? 'text-content' : 'text-brand-secondary',
                )}
              >
                {formatCOP(balance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-border">
          <h2 className="text-content font-semibold">Historial de pagos</h2>
          <p className="text-content-muted text-xs mt-0.5 font-accent">
            {history.length}{' '}
            {history.length === 1 ? 'movimiento registrado' : 'movimientos registrados'}
          </p>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 gradient-dark">
              <CreditCard className="w-7 h-7 text-white/60" />
            </div>
            <p className="text-content-muted text-sm font-medium">
              Aún no hay movimientos registrados
            </p>
            <p className="text-content-faint text-xs mt-1 font-accent">
              Los pagos desde Egresos y los movimientos históricos aparecerán aquí
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Fecha', 'Origen', 'Monto', 'Detalle', 'Referencia'].map((h) => (
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
                {history.map((entry, index) => {
                  const origin = ORIGIN_BADGE[entry.source]
                  return (
                    <tr
                      key={`${entry.source}-${index}`}
                      className="hover:bg-surface-raised transition-colors"
                    >
                      <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                            origin.className,
                          )}
                        >
                          {origin.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                        {formatCOP(Number(entry.amount))}
                        {entry.source === 'egreso' && Number(entry.creditAmount) > 0 && (
                          <p className="text-content-faint text-[11px] font-normal mt-0.5">
                            de los cuales {formatCOP(Number(entry.creditAmount))} fue saldo a favor
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {entry.source === 'egreso' && (
                          <button
                            onClick={() => navigate(`/egresos/${entry.egreso.id}`)}
                            className="flex items-center gap-1.5 text-xs text-brand-secondary hover:underline"
                          >
                            <Landmark className="w-3.5 h-3.5" />
                            {docNumber('EG', entry.egreso.number)}
                          </button>
                        )}
                        {entry.source === 'pago_historico' && (
                          <span className="flex items-center gap-1.5 text-content-muted text-xs">
                            <Landmark className="w-3.5 h-3.5 text-content-faint" />
                            {entry.paymentMethod}
                            {entry.bankDestination ? ` · ${entry.bankDestination}` : ''}
                          </span>
                        )}
                        {entry.source === 'nota_credito_historica' && (
                          <span className="text-content-muted text-xs">
                            Nota crédito aplicada
                            {Number(entry.supplierCredit.balance) > 0
                              ? ` (saldo restante: ${formatCOP(Number(entry.supplierCredit.balance))})`
                              : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-content-muted text-xs">
                        {entry.source === 'pago_historico' && entry.reference ? (
                          <span className="flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-content-faint" />
                            {entry.reference}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
