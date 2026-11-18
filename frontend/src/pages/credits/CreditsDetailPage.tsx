import { Fragment, useState } from 'react'
import { Link, useMatch, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, PiggyBank } from 'lucide-react'
import type {
  CreditDetailItem,
  CreditThirdPartyHeader,
  CustomerCreditDetailItem,
} from '@contracts/credits'

import { getCustomerCredits, getSupplierCredits } from '@/services/credits.service'
import { ErrorState } from '@/components/shared'
import { cn } from '@/lib/utils'
import { formatCOP, docNumber, formatDateOnly, formatBogotaDate } from '@/lib/format'
import { CREDIT_STATUS_BADGE, USABLE_IN_LABEL } from './credits.constants'

type CreditRow = CreditDetailItem &
  Partial<Pick<CustomerCreditDetailItem, 'usableIn' | 'branchName'>>

interface CreditsDetailData {
  header: CreditThirdPartyHeader
  credits: CreditRow[]
}

const originLabel = ({ origin }: CreditRow) =>
  origin.kind === 'excedente' || !origin.documentType || !origin.documentNumber
    ? 'Excedente'
    : docNumber(origin.documentType, origin.documentNumber)

export default function CreditsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const isCustomer = Boolean(useMatch('/saldos-a-favor/clientes/:id'))
  const tab = isCustomer ? 'clientes' : 'proveedores'
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data, isLoading, isError, refetch } = useQuery<CreditsDetailData>({
    queryKey: ['credits', tab, 'detail', id],
    queryFn: async () => {
      if (isCustomer) {
        const res = await getCustomerCredits(id!)
        return { header: res.customer, credits: res.credits }
      }
      const res = await getSupplierCredits(id!)
      return { header: res.supplier, credits: res.credits }
    },
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(id),
  })

  const toggle = (creditId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(creditId)) next.add(creditId)
      return next
    })

  const backLink = (
    <Link
      to={`/saldos-a-favor?tab=${tab}`}
      className="inline-flex items-center gap-2 text-sm text-content-secondary underline underline-offset-4 hover:text-content transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Volver a saldos a favor
    </Link>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="w-48 h-5 rounded-lg bg-surface-hover animate-pulse" />
        <div className="card-hard p-6 h-24 animate-pulse" />
        <div className="card-hard p-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-hover animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="card-hard">
          <ErrorState message="Error al cargar los saldos a favor" onRetry={refetch} />
        </div>
      </div>
    )
  }

  const { header } = data
  const credits = [...data.credits].sort((a, b) => b.date.localeCompare(a.date))
  const columns = [
    'Origen',
    'Fecha',
    ...(isCustomer ? ['Sucursal', 'Uso'] : []),
    'Valor original',
    'Usado',
    'Disponible',
    'Estado',
  ]

  return (
    <div className="space-y-6 pb-10">
      {backLink}

      <div className="card-hard p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0 gradient-user">
            {header.name[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h1 className="text-2xl text-content">{header.name}</h1>
            <p className="text-content-muted text-sm mt-1 font-mono">{header.documentNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md flex items-center justify-center bg-brand-secondary/10">
            <PiggyBank className="w-5 h-5 text-brand-secondary" />
          </div>
          <div>
            <p className="font-display font-black text-3xl leading-none text-content tabular-nums">
              {formatCOP(Number(header.availableTotal))}
            </p>
            <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-content-muted">
              Total disponible
            </p>
          </div>
        </div>
      </div>

      <div className="card-hard overflow-hidden">
        {credits.length === 0 ? (
          <p className="py-12 text-center text-sm text-content-faint">
            Este tercero no tiene saldos a favor
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ui-border">
                  <th className="w-10" />
                  {columns.map((h) => (
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
                {credits.map((credit) => {
                  const isOpen = expanded.has(credit.id)
                  const badge = CREDIT_STATUS_BADGE[credit.status]
                  return (
                    <Fragment key={credit.id}>
                      <tr
                        onClick={() => toggle(credit.id)}
                        className={cn(
                          'hover:bg-surface-raised transition-colors cursor-pointer',
                          credit.status === 'voided' && 'opacity-50',
                        )}
                      >
                        <td className="pl-5 py-3.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggle(credit.id)
                            }}
                            aria-expanded={isOpen}
                            aria-label={isOpen ? 'Ocultar dónde se usó' : 'Ver dónde se usó'}
                            className="p-1 rounded text-content-muted hover:text-content"
                          >
                            <ChevronRight
                              className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-90')}
                            />
                          </button>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs font-medium text-content whitespace-nowrap">
                          {originLabel(credit)}
                        </td>
                        <td className="px-5 py-3.5 text-content-muted text-xs whitespace-nowrap">
                          {formatDateOnly(credit.date)}
                        </td>
                        {isCustomer && (
                          <>
                            <td className="px-5 py-3.5 text-content-secondary">
                              {credit.branchName ?? '—'}
                            </td>
                            <td className="px-5 py-3.5 text-content-secondary whitespace-nowrap">
                              {credit.usableIn ? USABLE_IN_LABEL[credit.usableIn] : '—'}
                            </td>
                          </>
                        )}
                        <td className="px-5 py-3.5 text-content-secondary tabular-nums whitespace-nowrap">
                          {formatCOP(Number(credit.amount))}
                        </td>
                        <td className="px-5 py-3.5 text-content-secondary tabular-nums whitespace-nowrap">
                          {formatCOP(Number(credit.used))}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-content tabular-nums whitespace-nowrap">
                          {formatCOP(Number(credit.balance))}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn('pill-stamp', badge.className)}>{badge.label}</span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-surface-raised">
                          <td colSpan={columns.length + 1} className="px-5 py-4">
                            <p className="text-xs font-semibold text-content-faint uppercase tracking-wider mb-2">
                              Dónde se usó
                            </p>
                            {credit.applications.length === 0 ? (
                              <p className="text-sm text-content-muted">Sin usos</p>
                            ) : (
                              <ul className="space-y-1.5">
                                {credit.applications.map((app) => (
                                  <li
                                    key={app.id}
                                    className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm"
                                  >
                                    <span className="font-mono text-xs font-medium text-content min-w-28">
                                      {app.documentType && app.documentNumber
                                        ? docNumber(app.documentType, app.documentNumber)
                                        : 'Pago anterior'}
                                    </span>
                                    <span className="text-content-secondary tabular-nums">
                                      {formatCOP(Number(app.amount))}
                                    </span>
                                    <span className="text-content-muted text-xs">
                                      {formatBogotaDate(app.date)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
