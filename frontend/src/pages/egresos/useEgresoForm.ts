import { useEffect, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { getEgresoOpenItems, createEgreso } from '@/services/egresos.service'
import { egresoFormSchema, type EgresoFormValues } from './egreso-form.schema'
import {
  calculateAmountToPay,
  calculateFillCreditAmount,
  limitPayableAmount,
} from './egreso-form.utils'
import type { CreateEgresoPayload } from '@/types'
import { todayInBogota } from '@/lib/format'
import { getApiErrorMessage } from '@/lib/api-error'

const emptyDefaults = (): EgresoFormValues => ({
  supplierId: '',
  date: todayInBogota(),
  notes: '',
  payables: [],
  credits: [],
  payments: [],
})

// Toda la lógica de negocio del form de Egresos (carga, cuadre, envío) — la página solo arma el layout
export function useEgresoForm() {
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
  } = useForm<EgresoFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(egresoFormSchema) as any,
    defaultValues: emptyDefaults(),
  })

  const payablesArray = useFieldArray({ control, name: 'payables' })
  const creditsArray = useFieldArray({ control, name: 'credits' })
  const paymentsArray = useFieldArray({ control, name: 'payments' })

  const supplierId = watch('supplierId')

  const { data: openItems, isLoading: isLoadingOpenItems } = useQuery({
    queryKey: ['egresos-open-items', supplierId],
    queryFn: () => getEgresoOpenItems(supplierId),
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

  // Saldo a favor arranca en 0: usarlo o guardarlo para otra factura lo decide el operador
  function setCreditAmount(index: number, next: number) {
    const balance = watch(`credits.${index}.balance`)
    const clamped = Number.isNaN(next) || next < 0 ? 0 : Math.min(next, balance)
    setValue(`credits.${index}.amount`, clamped)
  }

  function fillCredit(index: number) {
    const othersSum = watch('credits').reduce(
      (sum, c, i) => (i === index ? sum : sum + (Number(c.amount) || 0)),
      0,
    )
    const balance = watch(`credits.${index}.balance`)
    setValue(`credits.${index}.amount`, calculateFillCreditAmount(balance, totalAbonos, othersSum))
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
  // No basta con que dineroAPagar === totalPayments: también hay que frenar si el saldo a favor ya supera los abonos
  const cuadraOk =
    Math.round(totalPayments) === Math.round(dineroAPagar) && totalCreditsApplied <= totalAbonos

  const { mutateAsync: createEgresoMutateAsync, isPending: isCreating } = useMutation({
    mutationFn: createEgreso,
  })

  async function submitEgreso(values: EgresoFormValues) {
    const payload: CreateEgresoPayload = {
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
      const egreso = await createEgresoMutateAsync(payload)
      queryClient.invalidateQueries({ queryKey: ['accounts-payable'] })
      queryClient.invalidateQueries({ queryKey: ['egresos'] })
      queryClient.invalidateQueries({ queryKey: ['egresos-open-items', values.supplierId] })
      toast.success(`Egreso EG-${egreso.number} registrado correctamente`)
      navigate(`/egresos/${egreso.id}`)
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
    setCreditAmount,
    fillCredit,
    errors,
    totalAbonos,
    totalCreditsApplied,
    dineroAPagar,
    totalPayments,
    cuadraOk,
    isLoadingOpenItems,
    hasSupplier: Boolean(supplierId),
    submitEgreso,
    isSubmitting: isCreating,
  }
}
