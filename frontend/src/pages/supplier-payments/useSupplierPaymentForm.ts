import { useEffect, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import {
  getSupplierPaymentOpenItems,
  createSupplierPayment,
} from '@/services/supplier-payments.service'
import {
  supplierPaymentFormSchema,
  type SupplierPaymentFormValues,
} from './supplier-payment-form.schema'
import {
  calculateAmountToPay,
  calculateCreditPending,
  limitPayableAmount,
} from './supplier-payment-form.utils'
import type { CreateSupplierPaymentPayload } from '@/types'
import { canUseCredit, findCreditOverflowIndex } from '@/lib/credit-application'
import { todayInBogota } from '@/lib/format'
import { getApiErrorMessage } from '@/lib/api-error'

const emptyDefaults = (): SupplierPaymentFormValues => ({
  supplierId: '',
  date: todayInBogota(),
  notes: '',
  payables: [],
  credits: [],
  payments: [],
})

// Toda la lógica de negocio del form de Egresos (carga, cuadre, envío) — la página solo arma el layout
export function useSupplierPaymentForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Se regenera por proveedor (abajo): reusar la key entre proveedores daría 409 en vez de crear el nuevo egreso
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const {
    control,
    register,
    watch,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<SupplierPaymentFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(supplierPaymentFormSchema) as any,
    defaultValues: emptyDefaults(),
  })

  const payablesArray = useFieldArray({ control, name: 'payables' })
  const creditsArray = useFieldArray({ control, name: 'credits' })
  const paymentsArray = useFieldArray({ control, name: 'payments' })

  const supplierId = watch('supplierId')

  const { data: openItems, isLoading: isLoadingOpenItems } = useQuery({
    queryKey: ['supplier-payments-open-items', supplierId],
    queryFn: () => getSupplierPaymentOpenItems(supplierId),
    enabled: Boolean(supplierId),
    staleTime: 30 * 1000,
  })

  // Cambiar de proveedor reinicia las filas: las CxP/saldos de uno no aplican a otro
  useEffect(() => {
    if (!openItems) return
    // balance llega como string (Decimal de Prisma); sin Number() acá zod rechaza el default con "expected number"
    payablesArray.replace(
      openItems.payables.map((p) => ({
        accountPayableId: p.id,
        balance: Number(p.balance),
        selected: false,
        amount: Number(p.balance),
      })),
    )
    creditsArray.replace(
      openItems.credits.map((c) => ({
        supplierCreditId: c.id,
        balance: Number(c.balance),
        amount: 0,
      })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openItems])

  useEffect(() => {
    idempotencyKeyRef.current = crypto.randomUUID()
  }, [supplierId])

  const watchedPayables = watch('payables')
  const watchedCredits = watch('credits')
  const watchedPayments = watch('payments')

  const selectedPayables = watchedPayables.filter((p) => p.selected)
  const totalAbonos = selectedPayables.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  // Un saldo se aplica completo o no se aplica; arranca sin usar
  function toggleCredit(index: number, used: boolean) {
    setValue(`credits.${index}.amount`, used ? watch(`credits.${index}.balance`) : 0)
  }

  function canUseCreditAt(index: number): boolean {
    const amounts = watchedCredits.map((c) => Number(c.amount) || 0)
    return canUseCredit(
      watchedCredits[index]?.balance ?? 0,
      calculateCreditPending(totalAbonos, amounts, index),
    )
  }

  function setPayableAmount(accountPayableId: string, next: number) {
    const index = watch('payables').findIndex((p) => p.accountPayableId === accountPayableId)
    if (index < 0) return
    const balance = watch(`payables.${index}.balance`)
    setValue(`payables.${index}.amount`, limitPayableAmount(next, balance))
  }

  function togglePayable(accountPayableId: string, selected: boolean) {
    const index = watch('payables').findIndex((p) => p.accountPayableId === accountPayableId)
    if (index < 0) return
    setValue(`payables.${index}.selected`, selected)
  }

  const totalCreditsApplied = watchedCredits.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
  const dineroAPagar = calculateAmountToPay(totalAbonos, totalCreditsApplied)
  const totalPayments = watchedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  // Un saldo marcado nunca se suelta solo: si ya no cabe en los abonos se bloquea el guardado y la fila muestra el error
  const creditOverflowIndex = findCreditOverflowIndex(
    watchedCredits.map((c) => Number(c.amount) || 0),
    totalAbonos,
  )
  const cuadraOk =
    Math.round(totalPayments) === Math.round(dineroAPagar) &&
    totalCreditsApplied <= totalAbonos &&
    creditOverflowIndex < 0

  const { mutateAsync: createSupplierPaymentMutateAsync, isPending: isCreating } = useMutation({
    mutationFn: createSupplierPayment,
  })

  async function submitSupplierPayment(values: SupplierPaymentFormValues) {
    const payload: CreateSupplierPaymentPayload = {
      supplierId: values.supplierId,
      date: values.date,
      notes: values.notes || undefined,
      idempotencyKey: idempotencyKeyRef.current,
      payables: values.payables
        .filter((p) => p.selected)
        .map((p) => ({ accountPayableId: p.accountPayableId, amount: p.amount })),
      credits: values.credits
        .filter((c) => c.amount > 0)
        .map((c) => ({ supplierCreditId: c.supplierCreditId, amount: c.amount })),
      payments: values.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference || undefined,
        bank: p.bank || undefined,
      })),
    }

    try {
      const supplierPayment = await createSupplierPaymentMutateAsync(payload)
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] })
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] })
      queryClient.invalidateQueries({ queryKey: ['excesses'] })
      queryClient.invalidateQueries({
        queryKey: ['supplier-payments-open-items', values.supplierId],
      })
      toast.success(`Egreso EG-${supplierPayment.number} registrado correctamente`)
      navigate(`/supplier-payments/${supplierPayment.id}`)
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Error al registrar el egreso'))
      // No invalidamos open-items acá: repoblaría payables/credits debajo del diálogo todavía abierto — el caller lo hace al cerrarlo
      throw err
    }
  }

  return {
    control,
    register,
    watch,
    setValue,
    reset,
    handleSubmit,
    payablesFields: payablesArray.fields,
    creditsFields: creditsArray.fields,
    paymentsArray,
    setPayableAmount,
    togglePayable,
    toggleCredit,
    canUseCreditAt,
    creditOverflowIndex,
    errors,
    totalAbonos,
    totalCreditsApplied,
    dineroAPagar,
    totalPayments,
    cuadraOk,
    isLoadingOpenItems,
    hasSupplier: Boolean(supplierId),
    submitSupplierPayment,
    isSubmitting: isCreating,
  }
}
