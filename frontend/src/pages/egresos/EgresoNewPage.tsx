import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Loader2, HandCoins } from 'lucide-react'

import { getThirdParties } from '@/services/third-parties.service'
import { getEgresoOpenItems } from '@/services/egresos.service'
import { Combobox, CreditsPanel, ThousandsInput } from '@/components/shared'
import type { ComboboxOption, CreditsPanelCredit } from '@/components/shared'
import { formatCOP, docNumber } from '@/lib/format'
import { getFirstErrorMessage } from '@/lib/form-errors'
import { cn } from '@/lib/utils'
import { useEgresoForm } from './useEgresoForm'
import { EGRESO_PAYMENT_METHOD_LABELS } from '@/types'
import type { EgresoPaymentMethod } from '@/types'
import type { ThirdParty } from '@/types/third-party.types'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

// ─── confirm dialog ───────────────────────────────────────────────────────────
// Mismo patrón que DocumentDetailPage.tsx: overlay + card, sin librería de modales.

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  isPending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-surface rounded-2xl border border-ui-border shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center gradient-action shrink-0 mt-0.5">
            <HandCoins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base text-content mb-2">{title}</h3>
            <p className="text-sm text-content-secondary leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl gradient-action transition-opacity disabled:opacity-60"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── main page ─────────────────────────────────────────────────────────────────

export default function EgresoNewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    control,
    register,
    watch,
    handleSubmit,
    payablesFields,
    creditsFields,
    paymentsArray,
    setPayableAmount,
    togglePayable,
    setCreditAmount,
    totalAbonos,
    totalCreditsApplied,
    dineroAPagar,
    totalPayments,
    cuadraOk,
    creditAllocationPreview,
    isLoadingOpenItems,
    hasSupplier,
    submitEgreso,
    isSubmitting,
  } = useEgresoForm()

  const [confirmOpen, setConfirmOpen] = useState(false)
  // Diferido hasta que se cierre el diálogo de confirmación, para no repoblar la tabla detrás de él
  const [needsOpenItemsRefetch, setNeedsOpenItemsRefetch] = useState(false)

  const [supplierSearch, setSupplierSearch] = useState('')
  const [debouncedSupplierSearch] = useDebounce(supplierSearch, 400)
  const [supplierSelectedName, setSupplierSelectedName] = useState('')

  const supplierId = watch('supplierId')

  const hasSupplierSearch = debouncedSupplierSearch.length >= 1
  const { data: supplierData, isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['third-parties-search-suppliers', debouncedSupplierSearch],
    queryFn: () =>
      getThirdParties({
        search: debouncedSupplierSearch || undefined,
        page: 1,
        limit: 30,
        isSupplier: true,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: hasSupplierSearch,
  })

  const supplierOptions: ComboboxOption[] = (supplierData?.items ?? []).map((tp: ThirdParty) => ({
    id: tp.id,
    label: tp.name,
  }))
  const supplierDisplayOptions: ComboboxOption[] =
    supplierId && !debouncedSupplierSearch
      ? [
          { id: supplierId, label: supplierSelectedName },
          ...supplierOptions.filter((o) => o.id !== supplierId),
        ]
      : supplierOptions

  // Mismo queryKey que useEgresoForm — TanStack comparte caché, no dispara una segunda request
  const { data: openItems } = useQuery({
    queryKey: ['egresos-open-items', supplierId],
    queryFn: () => getEgresoOpenItems(supplierId),
    enabled: Boolean(supplierId),
    staleTime: 30 * 1000,
  })

  const payableById = new Map((openItems?.payables ?? []).map((p) => [p.id, p]))
  const creditById = new Map((openItems?.credits ?? []).map((c) => [c.id, c]))
  const creditAllocationByPayable = new Map(
    creditAllocationPreview.map((p) => [p.accountPayableId, p]),
  )

  const watchedPayables = watch('payables')
  const watchedCredits = watch('credits')

  const hasSelectedPayable = watchedPayables.some((p) => p.selected)
  // c.balance es Decimal de Prisma: llega como string en el JSON aunque el tipo diga number.
  const totalCreditsAvailable = (openItems?.credits ?? []).reduce(
    (sum, c) => sum + Number(c.balance),
    0,
  )

  const creditsPanelData: CreditsPanelCredit[] = creditsFields.map((field, index) => {
    const openCredit = creditById.get(field.supplierCreditId)
    return {
      id: field.supplierCreditId,
      balance: watchedCredits[index]?.balance ?? field.balance,
      label: openCredit
        ? docNumber(openCredit.sourceDocument.type, openCredit.sourceDocument.number)
        : 'Saldo a favor',
    }
  })
  const creditAmounts = Object.fromEntries(
    creditsFields.map((field, index) => [
      field.supplierCreditId,
      watchedCredits[index]?.amount ?? 0,
    ]),
  )

  const openConfirm = handleSubmit(
    () => setConfirmOpen(true),
    (formErrors) => toast.error(getFirstErrorMessage(formErrors)),
  )

  const confirmAndSubmit = handleSubmit(
    async (values) => {
      try {
        await submitEgreso(values)
        setConfirmOpen(false)
      } catch {
        // El hook ya mostró el toast; el diálogo se deja abierto y el refetch queda pendiente hasta cerrarlo (ver onCancel)
        setNeedsOpenItemsRefetch(true)
      }
    },
    (formErrors) => {
      setConfirmOpen(false)
      toast.error(getFirstErrorMessage(formErrors))
    },
  )

  function closeConfirmDialog() {
    setConfirmOpen(false)
    if (needsOpenItemsRefetch) {
      setNeedsOpenItemsRefetch(false)
      queryClient.invalidateQueries({ queryKey: ['egresos-open-items', supplierId] })
    }
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

      <div>
        <h1 className="text-2xl text-content">Nuevo egreso</h1>
        <p className="text-content-muted text-sm mt-0.5 font-accent">
          Registra el pago de una o varias cuentas por pagar de un proveedor
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Columna principal ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Proveedor + fecha */}
          <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-content-secondary">
                  Proveedor <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="supplierId"
                  control={control}
                  render={({ field }) => (
                    <Combobox
                      value={field.value}
                      onChange={(id, option) => {
                        field.onChange(id)
                        setSupplierSelectedName(option.label)
                      }}
                      options={supplierDisplayOptions}
                      isLoading={isLoadingSuppliers}
                      placeholder="Selecciona un proveedor..."
                      searchValue={supplierSearch}
                      onSearchChange={setSupplierSearch}
                    />
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-content-secondary">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  {...register('date')}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary border-ui-border-medium"
                />
              </div>
            </div>
          </div>

          {!hasSupplier && (
            <div className="bg-surface rounded-2xl border border-ui-border shadow-sm">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 gradient-dark">
                  <HandCoins className="w-7 h-7 text-white/60" />
                </div>
                <p className="text-content-muted text-sm font-medium">
                  Elige un proveedor para ver sus cuentas por pagar
                </p>
                <p className="text-content-faint text-xs mt-1 font-accent">
                  Se mostrarán las cuentas abiertas y el saldo a favor disponible
                </p>
              </div>
            </div>
          )}

          {hasSupplier && isLoadingOpenItems && (
            <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-surface-hover animate-pulse" />
              ))}
            </div>
          )}

          {hasSupplier && !isLoadingOpenItems && (
            <>
              {/* Cuentas por pagar abiertas */}
              <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-ui-border">
                  <h2 className="text-content font-semibold">Cuentas por pagar abiertas</h2>
                  <p className="text-content-muted text-xs mt-0.5 font-accent">
                    Selecciona las que va a cubrir este egreso y ajusta el abono de cada una
                  </p>
                </div>

                {payablesFields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-content-muted text-sm font-medium">
                      Este proveedor no tiene cuentas por pagar abiertas
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ui-border">
                          {[
                            '',
                            'Documento',
                            'Fecha',
                            'Saldo',
                            'Abono',
                            'Reparto (vista previa)',
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
                        {payablesFields.map((field, index) => {
                          const row = watchedPayables[index]
                          const openPayable = payableById.get(field.accountPayableId)
                          const preview = creditAllocationByPayable.get(field.accountPayableId)
                          return (
                            <tr
                              key={field.id}
                              className={cn('transition-colors', !row?.selected && 'opacity-60')}
                            >
                              <td className="px-5 py-3">
                                <input
                                  type="checkbox"
                                  checked={row?.selected ?? false}
                                  onChange={(e) =>
                                    togglePayable(field.accountPayableId, e.target.checked)
                                  }
                                  className="w-4 h-4 rounded border-ui-border-medium text-brand-secondary focus:ring-brand-secondary/30"
                                />
                              </td>
                              <td className="px-5 py-3">
                                {openPayable ? (
                                  <span className="font-mono text-xs font-medium text-content">
                                    {docNumber(
                                      openPayable.document.type,
                                      openPayable.document.number,
                                    )}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-5 py-3 text-content-muted text-xs whitespace-nowrap">
                                {openPayable ? formatDate(openPayable.document.date) : '—'}
                              </td>
                              <td className="px-5 py-3 text-content-secondary text-xs whitespace-nowrap">
                                {formatCOP(row?.balance ?? 0)}
                              </td>
                              <td className="px-5 py-3">
                                <ThousandsInput
                                  value={row?.amount}
                                  onChange={(v) => setPayableAmount(field.accountPayableId, v ?? 0)}
                                  disabled={!row?.selected}
                                  className="w-32 py-1.5"
                                />
                              </td>
                              <td className="px-5 py-3 text-xs text-content-faint whitespace-nowrap">
                                {row?.selected && preview
                                  ? `Dinero ${formatCOP(preview.cashAmount)} · Saldo ${formatCOP(preview.creditAmount)}`
                                  : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Saldo a favor del proveedor */}
              <CreditsPanel
                title="Saldo a favor del proveedor"
                credits={creditsPanelData}
                creditAmounts={creditAmounts}
                setCreditAmount={setCreditAmount}
                creditsApplied={totalCreditsApplied}
                totalAvailable={totalCreditsAvailable}
              />

              {/* Formas de pago */}
              <div className="bg-surface rounded-2xl border border-ui-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-ui-border flex items-center justify-between">
                  <div>
                    <h2 className="text-content font-semibold">Formas de pago</h2>
                    <p className="text-content-muted text-xs mt-0.5 font-accent">
                      {dineroAPagar === 0
                        ? 'El saldo a favor cubre el total — no hace falta forma de pago'
                        : `Deben sumar ${formatCOP(dineroAPagar)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      paymentsArray.append({
                        method: '' as EgresoPaymentMethod,
                        amount: 0,
                        reference: '',
                        bank: '',
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-secondary border border-brand-secondary/30 rounded-lg hover:bg-brand-secondary/10 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar forma de pago
                  </button>
                </div>

                {paymentsArray.fields.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-content-muted text-sm">
                      Sin formas de pago agregadas todavía
                    </p>
                  </div>
                ) : (
                  <div className="p-6 space-y-4">
                    {paymentsArray.fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-3 items-start"
                      >
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-content-secondary">
                            Método
                          </label>
                          <select
                            {...register(`payments.${index}.method`)}
                            className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content transition-all focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary border-ui-border-medium"
                          >
                            <option value="">Selecciona...</option>
                            {Object.entries(EGRESO_PAYMENT_METHOD_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-content-secondary">
                            Monto
                          </label>
                          <Controller
                            name={`payments.${index}.amount`}
                            control={control}
                            render={({ field: amountField }) => (
                              <ThousandsInput
                                name={amountField.name}
                                value={amountField.value}
                                onChange={amountField.onChange}
                                onBlur={amountField.onBlur}
                                ref={amountField.ref}
                                placeholder="0"
                              />
                            )}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-content-secondary">
                            Referencia / N° de cheque
                          </label>
                          <input
                            {...register(`payments.${index}.reference`)}
                            placeholder="Opcional"
                            className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content placeholder:text-content-faint transition-all focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary border-ui-border-medium"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-content-secondary">
                            Banco
                          </label>
                          <input
                            {...register(`payments.${index}.bank`)}
                            placeholder="Opcional"
                            className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content placeholder:text-content-faint transition-all focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary border-ui-border-medium"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => paymentsArray.remove(index)}
                          className="p-2 mt-5 rounded-lg text-content-faint hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Quitar forma de pago"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notas */}
              <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6 space-y-1.5">
                <label className="block text-sm font-medium text-content-secondary">Notas</label>
                <textarea
                  {...register('notes')}
                  rows={3}
                  placeholder="Observaciones opcionales sobre este egreso..."
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-surface-raised text-content placeholder:text-content-faint transition-all focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary border-ui-border-medium resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* ── Resumen (sticky) ──────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <div className="bg-surface rounded-2xl border border-ui-border shadow-sm p-6 space-y-4">
            <div>
              <p className="text-xs text-content-faint font-accent uppercase tracking-wider">
                Dinero a pagar
              </p>
              <p className="text-4xl text-content mt-1 font-mono">{formatCOP(dineroAPagar)}</p>
              <div className="mt-2 space-y-0.5 text-xs font-accent">
                <div className="flex items-center justify-between text-content-muted">
                  <span>Total abonos</span>
                  <span className="font-mono">{formatCOP(totalAbonos)}</span>
                </div>
                {totalCreditsApplied > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Saldo a favor aplicado</span>
                    <span className="font-mono">− {formatCOP(totalCreditsApplied)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-ui-divide pt-4 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-content-secondary">Formas de pago</span>
                <span
                  className={cn(
                    'font-mono font-medium',
                    cuadraOk ? 'text-content' : 'text-red-500',
                  )}
                >
                  {formatCOP(totalPayments)}
                </span>
              </div>
              {!cuadraOk && (
                <p className="text-xs text-red-500 font-accent">
                  Las formas de pago deben sumar {formatCOP(dineroAPagar)}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                void openConfirm()
              }}
              disabled={!cuadraOk || !hasSelectedPayable || isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white rounded-xl gradient-action hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar egreso
            </button>
            <button
              type="button"
              onClick={() => navigate('/egresos')}
              className="w-full px-4 py-2 text-sm font-medium text-content-secondary border border-ui-border-medium rounded-xl hover:bg-surface-hover transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Registrar egreso"
        description={`Se registrará el pago por ${formatCOP(dineroAPagar)} en dinero${totalCreditsApplied > 0 ? ` y ${formatCOP(totalCreditsApplied)} en saldo a favor` : ''} a las cuentas por pagar seleccionadas. Esta acción no se puede deshacer.`}
        confirmLabel="Confirmar y registrar"
        isPending={isSubmitting}
        onConfirm={() => {
          void confirmAndSubmit()
        }}
        onCancel={closeConfirmDialog}
      />
    </div>
  )
}
