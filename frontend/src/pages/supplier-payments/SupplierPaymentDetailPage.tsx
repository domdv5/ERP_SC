import { useState } from 'react'
import { BackLink } from '@/components/shared'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Wallet, Banknote, HandCoins, Landmark, Hash, StickyNote, XCircle, Ban } from 'lucide-react'

import { getSupplierPayment, voidSupplierPayment } from '@/services/supplier-payments.service'
import { usePermission } from '@/hooks/usePermission'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatCOP, docNumber, formatDateOnly, formatDateTimeBogota } from '@/lib/format'
import { TREASURY_PAYMENT_METHOD_LABELS, SUPPLIER_PAYMENT_VOID_REASON_LABELS } from '@/types'
import type { SupplierPaymentVoidReason } from '@/types'
import { VoidSupplierPaymentDialog } from './VoidSupplierPaymentDialog'
import { getExcessCreditLabel } from './supplier-payment-form.utils'

const VOID_INVALIDATE_KEYS = [
  'supplier-payments',
  'supplier-payments-open-items',
  'accounts-payable',
  'documents',
  'excesses',
]

export default function SupplierPaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canVoid = usePermission('supplier_payment.void')
  const [voidOpen, setVoidOpen] = useState(false)

  const {
    data: supplierPayment,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['supplier-payments', id],
    queryFn: () => getSupplierPayment(id!),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(id),
  })

  const { mutate: doVoid, isPending: isVoiding } = useMutation({
    mutationFn: (vars: { reason: SupplierPaymentVoidReason; reasonOther?: string }) =>
      voidSupplierPayment(id!, vars.reason, vars.reasonOther),
    onSuccess: () => {
      VOID_INVALIDATE_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
      setVoidOpen(false)
      toast.success('Egreso anulado')
    },
    onError: (err: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] })
      toast.error(getApiErrorMessage(err, 'Error al anular el egreso'))
    },
  })

  const voidReasonText = supplierPayment
    ? supplierPayment.voidReason === 'otro'
      ? supplierPayment.voidReasonOther
      : supplierPayment.voidReason &&
        SUPPLIER_PAYMENT_VOID_REASON_LABELS[supplierPayment.voidReason]
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

  if (isError || !supplierPayment) {
    return (
      <div className="space-y-4">
        <BackLink to="/supplier-payments" />
        <div className="bg-surface rounded-2xl border border-ui-border p-8 text-center">
          <Wallet className="w-12 h-12 text-content-faint mx-auto mb-3" />
          <p className="text-content-secondary mb-3">Error al cargar el egreso</p>
          <button onClick={() => refetch()} className="text-sm link-plain">
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Back */}
      <BackLink to="/supplier-payments" />

      {supplierPayment.voidedAt && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border-2 border-red-500/40">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            Anulado por {supplierPayment.voidedBy?.name ?? 'un usuario'} el{' '}
            {formatDateTimeBogota(supplierPayment.voidedAt)}{' '}
            {voidReasonText && <> — Motivo: {voidReasonText}</>}
          </p>
        </div>
      )}

      {/* Header card */}
      <div className="card-hard p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 gradient-user">
              {supplierPayment.supplier.thirdParty.name[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <h1 className="text-2xl text-content font-mono">
                {docNumber('EG', supplierPayment.number)}
              </h1>
              <p className="text-content-muted text-sm mt-1 font-accent">
                <button
                  onClick={() =>
                    navigate(`/accounts-payable/suppliers/${supplierPayment.supplier.id}`)
                  }
                  className="text-content font-semibold underline decoration-content-muted underline-offset-4 hover:decoration-content"
                >
                  {supplierPayment.supplier.thirdParty.name}
                </button>{' '}
                &middot; {formatDateOnly(supplierPayment.date)} &middot; Registrado por{' '}
                {supplierPayment.user.name}
              </p>
            </div>
          </div>
          {canVoid && !supplierPayment.voidedAt && (
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
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-ui-divide pt-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <Banknote className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Dinero pagado</p>
              <p className="text-sm text-content font-medium">
                {formatCOP(Number(supplierPayment.cashTotal))}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <HandCoins className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Saldo a favor</p>
              <p className="text-sm text-content font-medium">
                {formatCOP(Number(supplierPayment.creditTotal))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Formas de pago */}
      <div className="card-hard overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-border">
          <h2 className="text-content font-semibold">Formas de pago</h2>
          <p className="text-content-muted text-xs mt-0.5 font-accent">
            {supplierPayment.payments.length}{' '}
            {supplierPayment.payments.length === 1
              ? 'forma de pago registrada'
              : 'formas de pago registradas'}
          </p>
        </div>

        {supplierPayment.payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-content-muted text-sm font-medium">
              Este egreso se cubrió completamente con saldo a favor
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
                {supplierPayment.payments.map((payment) => (
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

      {/* Cuentas por pagar abonadas */}
      <div className="card-hard overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-border">
          <h2 className="text-content font-semibold">Cuentas por pagar abonadas</h2>
          <p className="text-content-muted text-xs mt-0.5 font-accent">
            {supplierPayment.allocations.length}{' '}
            {supplierPayment.allocations.length === 1 ? 'cuenta abonada' : 'cuentas abonadas'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ui-border">
                {['Documento', 'Abonado', 'Dinero pagado', 'Saldo a favor'].map((h) => (
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
              {supplierPayment.allocations.map((allocation) => {
                const amount = Number(allocation.amount)
                const creditAmount = Number(allocation.creditAmount)
                const cashAmount = amount - creditAmount
                return (
                  <tr key={allocation.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/accounts-payable/${allocation.accountPayableId}`}
                        className="font-mono text-xs font-medium text-content underline decoration-content-muted underline-offset-4 hover:decoration-content"
                      >
                        {docNumber(
                          allocation.accountPayable.document.type,
                          allocation.accountPayable.document.number,
                        )}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-content-secondary font-medium text-xs whitespace-nowrap">
                      {formatCOP(amount)}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatCOP(cashAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                      {formatCOP(creditAmount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saldos a favor usados */}
      {supplierPayment.creditApplications.length > 0 && (
        <div className="card-hard overflow-hidden">
          <div className="px-6 py-4 border-b border-ui-border">
            <h2 className="text-content font-semibold">Saldos a favor usados</h2>
            <p className="text-content-muted text-xs mt-0.5 font-accent">
              {supplierPayment.creditApplications.length}{' '}
              {supplierPayment.creditApplications.length === 1 ? 'aplicación' : 'aplicaciones'}
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
                {supplierPayment.creditApplications.map((application) => (
                  <tr key={application.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3.5">
                      {application.supplierCredit.sourceDocument ? (
                        <Link
                          to={`/documents/${application.supplierCredit.sourceDocument.id}`}
                          className="font-mono text-xs font-medium text-content underline decoration-content-muted underline-offset-4 hover:decoration-content"
                        >
                          {docNumber(
                            application.supplierCredit.sourceDocument.type,
                            application.supplierCredit.sourceDocument.number,
                          )}
                        </Link>
                      ) : (
                        <span className="text-xs text-content-faint">
                          {getExcessCreditLabel(application.supplierCredit)
                            ? `Excedente ${getExcessCreditLabel(application.supplierCredit)}`
                            : 'Sin documento de origen'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/documents/${application.accountPayable.document.id}`}
                        className="font-mono text-xs font-medium text-content underline decoration-content-muted underline-offset-4 hover:decoration-content"
                      >
                        {docNumber(
                          application.accountPayable.document.type,
                          application.accountPayable.document.number,
                        )}
                      </Link>
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
      {supplierPayment.notes && (
        <div className="card-hard p-6">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-content-faint mb-2">
            <StickyNote className="w-3.5 h-3.5" />
            Notas
          </p>
          <p className="text-sm text-content-secondary whitespace-pre-wrap font-accent">
            {supplierPayment.notes}
          </p>
        </div>
      )}

      <VoidSupplierPaymentDialog
        key={voidOpen ? 'open' : 'closed'}
        open={voidOpen}
        supplierPaymentLabel={docNumber('EG', supplierPayment.number)}
        isPending={isVoiding}
        onConfirm={doVoid}
        onCancel={() => setVoidOpen(false)}
      />
    </div>
  )
}
