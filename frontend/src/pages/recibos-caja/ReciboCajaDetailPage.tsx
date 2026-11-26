import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { BackLink } from '@/components/shared'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Wallet,
  Banknote,
  HandCoins,
  Landmark,
  Hash,
  StickyNote,
  Percent,
  XCircle,
  Ban,
} from 'lucide-react'

import { getReciboCaja, voidReciboCaja } from '@/services/recibos-caja.service'
import { usePermission } from '@/hooks/usePermission'
import { getApiErrorMessage } from '@/lib/api-error'
import { invalidateAfterReciboCajaVoid } from '@/lib/invalidation'
import { formatCOP, docNumber, formatDateOnly, formatDateTimeBogota } from '@/lib/format'
import { TREASURY_PAYMENT_METHOD_LABELS, RECIBO_CAJA_VOID_REASON_LABELS } from '@/types'
import type { ReciboCajaVoidReason } from '@/types'
import { VoidReciboCajaDialog } from './VoidReciboCajaDialog'
import { RECIBO_CAJA_DISCOUNT_REASON_LABELS } from './recibo-caja-form.schema'
import { calculateAllocationCash, sumAmounts } from './recibo-caja-totals'

export default function ReciboCajaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canVoid = usePermission('recibo.void')
  const [voidOpen, setVoidOpen] = useState(false)

  const {
    data: reciboCaja,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['recibos-caja', id],
    queryFn: () => getReciboCaja(id!),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(id),
  })

  const { mutate: doVoid, isPending: isVoiding } = useMutation({
    mutationFn: (vars: { reason: ReciboCajaVoidReason; reasonOther?: string }) =>
      voidReciboCaja(id!, vars.reason, vars.reasonOther),
    onSuccess: () => {
      invalidateAfterReciboCajaVoid(queryClient)
      setVoidOpen(false)
      toast.success('Recibo de caja anulado')
    },
    onError: (err: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['recibos-caja'] })
      toast.error(getApiErrorMessage(err, 'Error al anular el recibo de caja'))
    },
  })

  const voidReasonText = reciboCaja
    ? reciboCaja.voidReason === 'otro'
      ? reciboCaja.voidReasonOther
      : reciboCaja.voidReason && RECIBO_CAJA_VOID_REASON_LABELS[reciboCaja.voidReason]
    : null

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

  if (isError || !reciboCaja) {
    return (
      <div className="space-y-4">
        <BackLink to="/recibos-caja" />
        <div className="bg-surface rounded-2xl border border-ui-border p-8 text-center">
          <Wallet className="w-12 h-12 text-content-faint mx-auto mb-3" />
          <p className="text-content-secondary mb-3">Error al cargar el recibo de caja</p>
          <button onClick={() => refetch()} className="text-sm link-plain">
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  const hasDiscount = Number(reciboCaja.discountAmount) > 0
  const creditApplications = reciboCaja.creditApplications ?? []
  const totalCredits = sumAmounts(creditApplications)

  return (
    <div className="space-y-6 pb-10">
      {/* Back */}
      <BackLink to="/recibos-caja" />

      {reciboCaja.voidedAt && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border-2 border-red-500/40">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            Anulado por {reciboCaja.voidedBy?.name ?? 'un usuario'} el{' '}
            {formatDateTimeBogota(reciboCaja.voidedAt)}{' '}
            {voidReasonText && <> — Motivo: {voidReasonText}</>}
          </p>
        </div>
      )}

      {/* Header card */}
      <div className="card-hard p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 gradient-user">
              {reciboCaja.client.thirdParty.name[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <h1 className="text-2xl text-content font-mono">
                {docNumber('RC', reciboCaja.number)}
              </h1>
              <p className="text-content-muted text-sm mt-1 font-accent">
                <button
                  onClick={() => navigate(`/accounts-receivable/clients/${reciboCaja.client.id}`)}
                  className="text-content font-semibold underline decoration-content-muted underline-offset-4 hover:decoration-content"
                >
                  {reciboCaja.client.thirdParty.name}
                </button>
                {reciboCaja.customerBranch && <> &middot; {reciboCaja.customerBranch.name}</>}{' '}
                &middot; {formatDateOnly(reciboCaja.date)} &middot; Registrado por{' '}
                {reciboCaja.user.name}
              </p>
            </div>
          </div>
          {canVoid && !reciboCaja.voidedAt && (
            <button
              onClick={() => setVoidOpen(true)}
              className="btn-danger flex items-center gap-2 px-4 py-2 text-sm"
            >
              <Ban className="w-4 h-4" />
              Anular
            </button>
          )}
        </div>

        {/* Resumen */}
        <div
          className={`mt-6 grid grid-cols-1 sm:grid-cols-2 ${hasDiscount ? 'lg:grid-cols-3' : ''} gap-5 border-t border-ui-divide pt-5`}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <Banknote className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Dinero recibido</p>
              <p className="text-sm text-content font-medium">
                {formatCOP(Number(reciboCaja.total))}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <HandCoins className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Saldo a favor</p>
              <p className="text-sm text-content font-medium">{formatCOP(totalCredits)}</p>
            </div>
          </div>

          {hasDiscount && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
                <Percent className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-content-faint">Descuento</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                  {formatCOP(Number(reciboCaja.discountAmount))}
                </p>
                {reciboCaja.discountReason && (
                  <span className="pill-stamp mt-1 inline-block bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                    {RECIBO_CAJA_DISCOUNT_REASON_LABELS[reciboCaja.discountReason]}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formas de pago */}
      <div className="card-hard overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-border">
          <h2 className="text-content font-semibold">Formas de pago</h2>
          <p className="text-content-muted text-xs mt-0.5 font-accent">
            {reciboCaja.payments.length}{' '}
            {reciboCaja.payments.length === 1
              ? 'forma de pago registrada'
              : 'formas de pago registradas'}
          </p>
        </div>

        {reciboCaja.payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-content-muted text-sm font-medium">
              Este recibo no tiene formas de pago registradas
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Método', 'Monto', 'Referencia', 'Banco'].map((h) => (
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
                {reciboCaja.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-1.5 text-content-secondary text-xs">
                        <Landmark className="w-3.5 h-3.5 text-content-faint" />
                        {TREASURY_PAYMENT_METHOD_LABELS[payment.method]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(payment.amount))}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">
                      {payment.reference ? (
                        <span className="flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-content-faint" />
                          {payment.reference}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs">
                      {payment.bank ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cuentas por cobrar abonadas */}
      <div className="card-hard overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-border">
          <h2 className="text-content font-semibold">Cuentas por cobrar abonadas</h2>
          <p className="text-content-muted text-xs mt-0.5 font-accent">
            {reciboCaja.allocations.length}{' '}
            {reciboCaja.allocations.length === 1 ? 'cuenta abonada' : 'cuentas abonadas'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ui-border">
                {[
                  'Documento',
                  'Abonado',
                  'Dinero recibido',
                  'Saldo a favor',
                  ...(hasDiscount ? ['Descuento'] : []),
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
              {reciboCaja.allocations.map((allocation) => {
                const cashAmount = calculateAllocationCash(allocation)
                return (
                  <tr key={allocation.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/documents/${allocation.accountReceivable.documentId}`}
                        className="font-mono text-xs font-medium text-content underline decoration-content-muted underline-offset-4 hover:decoration-content"
                      >
                        {docNumber(
                          allocation.accountReceivable.document.type,
                          allocation.accountReceivable.document.number,
                        )}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(allocation.amount))}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {cashAmount === null ? '—' : formatCOP(cashAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {allocation.creditAmount === null
                        ? '—'
                        : formatCOP(Number(allocation.creditAmount))}
                    </td>
                    {hasDiscount && (
                      <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                        {formatCOP(Number(allocation.discountAmount))}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saldos a favor usados */}
      {creditApplications.length > 0 && (
        <div className="card-hard overflow-hidden">
          <div className="px-6 py-4 border-b border-ui-border">
            <h2 className="text-content font-semibold">Saldos a favor usados</h2>
            <p className="text-content-muted text-xs mt-0.5 font-accent">
              {creditApplications.length}{' '}
              {creditApplications.length === 1 ? 'aplicación' : 'aplicaciones'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Origen', 'Aplicado a', 'Monto aplicado'].map((h) => (
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
                {creditApplications.map((application) => (
                  <tr key={application.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3.5">
                      {application.customerCredit.sourceDocument ? (
                        <Link
                          to={`/documents/${application.customerCredit.sourceDocument.id}`}
                          className="font-mono text-xs font-medium text-content underline decoration-content-muted underline-offset-4 hover:decoration-content"
                        >
                          {docNumber(
                            application.customerCredit.sourceDocument.type,
                            application.customerCredit.sourceDocument.number,
                          )}
                        </Link>
                      ) : (
                        <span className="text-xs text-content-faint">Excedente</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {application.accountReceivable ? (
                        <Link
                          to={`/documents/${application.accountReceivable.document.id}`}
                          className="font-mono text-xs font-medium text-content underline decoration-content-muted underline-offset-4 hover:decoration-content"
                        >
                          {docNumber(
                            application.accountReceivable.document.type,
                            application.accountReceivable.document.number,
                          )}
                        </Link>
                      ) : (
                        <span className="text-xs text-content-faint">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(Number(application.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notas */}
      {reciboCaja.notes && (
        <div className="card-hard p-6">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-content-faint mb-2">
            <StickyNote className="w-3.5 h-3.5" />
            Notas
          </p>
          <p className="text-sm text-content-secondary whitespace-pre-wrap font-accent">
            {reciboCaja.notes}
          </p>
        </div>
      )}

      <VoidReciboCajaDialog
        key={voidOpen ? 'open' : 'closed'}
        open={voidOpen}
        reciboLabel={docNumber('RC', reciboCaja.number)}
        isPending={isVoiding}
        onConfirm={doVoid}
        onCancel={() => setVoidOpen(false)}
      />
    </div>
  )
}
