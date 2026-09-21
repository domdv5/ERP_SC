import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Wallet, Banknote, HandCoins, Landmark, Hash, StickyNote } from 'lucide-react'

import { getEgreso } from '@/services/egresos.service'
import { formatCOP, docNumber } from '@/lib/format'
import { EGRESO_PAYMENT_METHOD_LABELS } from '@/types'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

export default function EgresoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const {
    data: egreso,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['egresos', id],
    queryFn: () => getEgreso(id!),
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

  if (isError || !egreso) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/egresos')}
          className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a egresos
        </button>
        <div className="bg-surface rounded-2xl border border-ui-border p-8 text-center">
          <Wallet className="w-12 h-12 text-content-faint mx-auto mb-3" />
          <p className="text-content-secondary mb-3">Error al cargar el egreso</p>
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

  return (
    <div className="space-y-6 pb-10">
      {/* Back */}
      <button
        onClick={() => navigate('/egresos')}
        className="flex items-center gap-2 text-sm text-content-muted hover:text-content transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a egresos
      </button>

      {/* Header card */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 gradient-user">
            {egreso.supplier.thirdParty.name[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h1 className="text-2xl text-content font-mono">{docNumber('EG', egreso.number)}</h1>
            <p className="text-content-muted text-sm mt-1 font-accent">
              <button
                onClick={() => navigate(`/accounts-payable/suppliers/${egreso.supplier.id}`)}
                className="text-brand-secondary hover:underline font-medium"
              >
                {egreso.supplier.thirdParty.name}
              </button>{' '}
              &middot; {formatDate(egreso.date)} &middot; Registrado por {egreso.user.name}
            </p>
          </div>
        </div>

        {/* Resumen */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-5 border-t border-ui-divide pt-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Total</p>
              <p className="text-sm text-content font-medium">{formatCOP(Number(egreso.total))}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center shrink-0">
              <Banknote className="w-4 h-4 text-content-muted" />
            </div>
            <div>
              <p className="text-xs text-content-faint">Dinero</p>
              <p className="text-sm text-content font-medium">
                {formatCOP(Number(egreso.cashTotal))}
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
                {formatCOP(Number(egreso.creditTotal))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Formas de pago */}
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-border">
          <h2 className="text-content font-semibold">Formas de pago</h2>
          <p className="text-content-muted text-xs mt-0.5 font-accent">
            {egreso.payments.length}{' '}
            {egreso.payments.length === 1
              ? 'forma de pago registrada'
              : 'formas de pago registradas'}
          </p>
        </div>

        {egreso.payments.length === 0 ? (
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
                {egreso.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-1.5 text-content-secondary text-xs">
                        <Landmark className="w-3.5 h-3.5 text-content-faint" />
                        {EGRESO_PAYMENT_METHOD_LABELS[payment.method]}
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
      <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ui-border">
          <h2 className="text-content font-semibold">Cuentas por pagar abonadas</h2>
          <p className="text-content-muted text-xs mt-0.5 font-accent">
            {egreso.allocations.length}{' '}
            {egreso.allocations.length === 1 ? 'cuenta abonada' : 'cuentas abonadas'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ui-border">
                {['Documento', 'Abonado', 'Dinero', 'Saldo a favor'].map((h) => (
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
              {egreso.allocations.map((allocation) => {
                const amount = Number(allocation.amount)
                const creditAmount = Number(allocation.creditAmount)
                const cashAmount = amount - creditAmount
                return (
                  <tr key={allocation.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/accounts-payable/${allocation.accountPayableId}`}
                        className="font-mono text-xs font-medium text-brand-secondary hover:underline"
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
      {egreso.creditApplications.length > 0 && (
        <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-ui-border">
            <h2 className="text-content font-semibold">Saldos a favor usados</h2>
            <p className="text-content-muted text-xs mt-0.5 font-accent">
              {egreso.creditApplications.length}{' '}
              {egreso.creditApplications.length === 1 ? 'aplicación' : 'aplicaciones'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  {['Origen', 'Monto aplicado'].map((h) => (
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
                {egreso.creditApplications.map((application) => (
                  <tr key={application.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/documents/${application.supplierCredit.sourceDocument.id}`}
                        className="font-mono text-xs font-medium text-brand-secondary hover:underline"
                      >
                        {docNumber(
                          application.supplierCredit.sourceDocument.type,
                          application.supplierCredit.sourceDocument.number,
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
      {egreso.notes && (
        <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-content-faint mb-2">
            <StickyNote className="w-3.5 h-3.5" />
            Notas
          </p>
          <p className="text-sm text-content-secondary whitespace-pre-wrap font-accent">
            {egreso.notes}
          </p>
        </div>
      )}
    </div>
  )
}
