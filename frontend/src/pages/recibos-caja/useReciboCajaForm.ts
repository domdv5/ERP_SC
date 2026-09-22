import { useEffect, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { getReciboCajaOpenItems, createReciboCaja } from '@/services/recibos-caja.service'
import { reciboCajaFormSchema, type ReciboCajaFormValues } from './recibo-caja-form.schema'
import type { CreateReciboCajaPayload } from '@/types'

const today = () => new Date().toISOString().slice(0, 10)

function extractErrorMessage(err: unknown): string | undefined {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  return typeof message === 'string' ? message : undefined
}

const emptyDefaults = (): ReciboCajaFormValues => ({
  clientId: '',
  date: today(),
  notes: '',
  receivables: [],
  payments: [],
})

// Toda la lógica de negocio del form de Recibos de Caja (carga, cuadre, envío) — la página solo arma el layout
export function useReciboCajaForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Se regenera por cliente (abajo): reusar la key entre clientes daría 409 en vez de crear el nuevo recibo
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const { control, register, watch, setValue, reset, handleSubmit } = useForm<ReciboCajaFormValues>(
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolver: zodResolver(reciboCajaFormSchema) as any,
      defaultValues: emptyDefaults(),
    },
  )

  const receivablesArray = useFieldArray({ control, name: 'receivables' })
  const paymentsArray = useFieldArray({ control, name: 'payments' })

  const clientId = watch('clientId')

  const { data: openItems, isLoading: isLoadingOpenItems } = useQuery({
    queryKey: ['recibos-caja-open-items', clientId],
    queryFn: () => getReciboCajaOpenItems(clientId),
    enabled: Boolean(clientId),
    staleTime: 30 * 1000,
  })

  // Cambiar de cliente reinicia las filas: las CxC de uno no aplican a otro
  useEffect(() => {
    if (!openItems) return
    // balance llega como string (Decimal de Prisma); sin Number() acá zod rechaza el default con "expected number"
    receivablesArray.replace(
      openItems.receivables.map((r) => ({
        accountReceivableId: r.id,
        balance: Number(r.balance),
        selected: false,
        amount: Number(r.balance),
      })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openItems])

  useEffect(() => {
    idempotencyKeyRef.current = crypto.randomUUID()
  }, [clientId])

  const watchedReceivables = watch('receivables')
  const watchedPayments = watch('payments')

  const selectedReceivables = watchedReceivables.filter((r) => r.selected)
  const totalAbonos = selectedReceivables.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const totalPayments = watchedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const cuadraOk = Math.round(totalPayments) === Math.round(totalAbonos)

  function setReceivableAmount(accountReceivableId: string, next: number) {
    const index = watch('receivables').findIndex(
      (r) => r.accountReceivableId === accountReceivableId,
    )
    if (index < 0) return
    const balance = watch(`receivables.${index}.balance`)
    const clamped = Number.isNaN(next) || next < 0 ? 0 : Math.min(next, balance)
    setValue(`receivables.${index}.amount`, clamped)
  }

  function toggleReceivable(accountReceivableId: string, selected: boolean) {
    const index = watch('receivables').findIndex(
      (r) => r.accountReceivableId === accountReceivableId,
    )
    if (index < 0) return
    setValue(`receivables.${index}.selected`, selected)
  }

  const { mutateAsync: createReciboCajaMutateAsync, isPending: isCreating } = useMutation({
    mutationFn: createReciboCaja,
  })

  async function submitReciboCaja(values: ReciboCajaFormValues) {
    const payload: CreateReciboCajaPayload = {
      clientId: values.clientId,
      date: values.date,
      notes: values.notes || undefined,
      idempotencyKey: idempotencyKeyRef.current,
      receivables: values.receivables
        .filter((r) => r.selected)
        .map((r) => ({ accountReceivableId: r.accountReceivableId, amount: r.amount })),
      payments: values.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference || undefined,
        bank: p.bank || undefined,
      })),
    }

    try {
      const reciboCaja = await createReciboCajaMutateAsync(payload)
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] })
      queryClient.invalidateQueries({ queryKey: ['recibos-caja'] })
      queryClient.invalidateQueries({ queryKey: ['recibos-caja-open-items', values.clientId] })
      toast.success(`Recibo de caja RC-${reciboCaja.number} registrado correctamente`)
      navigate(`/recibos-caja/${reciboCaja.id}`)
    } catch (err) {
      toast.error(extractErrorMessage(err) ?? 'Error al registrar el recibo de caja')
      // No invalidamos open-items acá: repoblaría receivables debajo del diálogo todavía abierto — el caller lo hace al cerrarlo
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
    receivablesFields: receivablesArray.fields,
    paymentsArray,
    setReceivableAmount,
    toggleReceivable,
    totalAbonos,
    totalPayments,
    cuadraOk,
    isLoadingOpenItems,
    hasClient: Boolean(clientId),
    submitReciboCaja,
    isSubmitting: isCreating,
  }
}
