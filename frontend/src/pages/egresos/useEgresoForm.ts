import { useEffect, useMemo, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { getEgresoOpenItems, createEgreso } from '@/services/egresos.service'
import { proposeCreditApplication, clampCreditAmount } from '@/lib/credit-application'
import { egresoFormSchema, type EgresoFormValues } from './egreso-form.schema'
import {
  previewCreditAllocation,
  computeDineroAPagar,
  clampPayableAmount,
} from './egreso-form.utils'
import type { CreateEgresoPayload } from '@/types'

const today = () => new Date().toISOString().slice(0, 10)

function extractErrorMessage(err: unknown): string | undefined {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  return typeof message === 'string' ? message : undefined
}

const emptyDefaults = (): EgresoFormValues => ({
  supplierId: '',
  date: today(),
  notes: '',
  payables: [],
  credits: [],
  payments: [],
})

// Toda la lógica de negocio del form de Egresos (carga, cuadre, reparto FIFO, envío) — la página solo arma el layout
export function useEgresoForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Se regenera por proveedor (abajo): reusar la key entre proveedores daría 409 en vez de crear el nuevo egreso
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const { control, register, watch, setValue, reset, handleSubmit } = useForm<EgresoFormValues>({
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

  // Tocar un saldo a mano no congela los demás: solo los no tocados se siguen recalculando
  const creditsTouchedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    creditsTouchedRef.current = new Set()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId])

  // Propone aplicar el máximo posible de saldo a favor (los más antiguos primero, tal como
  // llegan de open-items) hasta cubrir el total de abonos seleccionado.
  useEffect(() => {
    if (creditsArray.fields.length === 0) return
    const touched = creditsTouchedRef.current
    const current = watch('credits')

    const manuallyAppliedSum = current
      .filter((c) => touched.has(c.supplierCreditId))
      .reduce((sum, c) => sum + Math.max(0, Math.min(Number(c.amount) || 0, c.balance)), 0)
    const remaining = Math.max(totalAbonos - manuallyAppliedSum, 0)

    const proposal = proposeCreditApplication(
      current
        .filter((c) => !touched.has(c.supplierCreditId))
        .map((c) => ({ id: c.supplierCreditId, balance: c.balance })),
      remaining,
    )
    const proposedById = new Map(proposal.map((p) => [p.id, p.amount]))

    current.forEach((c, index) => {
      const next = touched.has(c.supplierCreditId)
        ? c.amount
        : (proposedById.get(c.supplierCreditId) ?? 0)
      if (next !== c.amount) setValue(`credits.${index}.amount`, next)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalAbonos, creditsArray.fields.length])

  function setCreditAmount(supplierCreditId: string, next: number) {
    creditsTouchedRef.current.add(supplierCreditId)
    const index = watch('credits').findIndex((c) => c.supplierCreditId === supplierCreditId)
    if (index < 0) return
    const credit = watch(`credits.${index}`)
    const othersSum = watch('credits').reduce(
      (sum, c, i) => (i === index ? sum : sum + (Number(c.amount) || 0)),
      0,
    )
    setValue(
      `credits.${index}.amount`,
      clampCreditAmount(next, credit.balance, totalAbonos, othersSum),
    )
  }

  function setPayableAmount(accountPayableId: string, next: number) {
    const index = watch('payables').findIndex((p) => p.accountPayableId === accountPayableId)
    if (index < 0) return
    const balance = watch(`payables.${index}.balance`)
    setValue(`payables.${index}.amount`, clampPayableAmount(next, balance))
  }

  function togglePayable(accountPayableId: string, selected: boolean) {
    const index = watch('payables').findIndex((p) => p.accountPayableId === accountPayableId)
    if (index < 0) return
    setValue(`payables.${index}.selected`, selected)
  }

  const totalCreditsApplied = watchedCredits.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
  const dineroAPagar = computeDineroAPagar(totalAbonos, totalCreditsApplied)
  const totalPayments = watchedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  // No basta con que dineroAPagar === totalPayments: también hay que frenar si el saldo a favor ya supera los abonos
  const cuadraOk =
    Math.round(totalPayments) === Math.round(dineroAPagar) && totalCreditsApplied <= totalAbonos

  // Vista previa informativa del reparto FIFO: en qué CxP entra cada peso del saldo a favor
  // aplicado. El backend recalcula esto de verdad al crear el egreso.
  const creditAllocationPreview = useMemo(
    () =>
      previewCreditAllocation(
        selectedPayables.map((p) => ({
          accountPayableId: p.accountPayableId,
          amount: Number(p.amount) || 0,
        })),
        totalCreditsApplied,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(selectedPayables), totalCreditsApplied],
  )

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
      toast.error(extractErrorMessage(err) ?? 'Error al registrar el egreso')
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
    totalAbonos,
    totalCreditsApplied,
    dineroAPagar,
    totalPayments,
    cuadraOk,
    creditAllocationPreview,
    isLoadingOpenItems,
    hasSupplier: Boolean(supplierId),
    submitEgreso,
    isSubmitting: isCreating,
  }
}
