import { z } from 'zod'
import { formatCOP } from '@/lib/format'

// El input con separador de miles (ThousandsInput) devuelve vacío como `undefined`; se trata
// como 0 para que la validación siempre sume números.
const moneyAmount = z.preprocess(
  (v) => (v == null ? 0 : v),
  z.number().min(0, 'El monto no puede ser negativo'),
)

// `balance` viaja en cada fila solo para validar en el cliente que no se abone/aplique más de
// lo disponible; se descarta antes de armar el payload real.
const payableRowSchema = z.object({
  accountPayableId: z.string(),
  balance: z.coerce.number(),
  selected: z.boolean(),
  amount: moneyAmount,
})

const creditRowSchema = z.object({
  supplierCreditId: z.string(),
  balance: z.coerce.number(),
  amount: moneyAmount,
})

export const EGRESO_PAYMENT_METHODS = [
  'efectivo_almacen',
  'consignacion_almacen',
  'cheque',
  'efectivo_oficina',
  'consignacion_oficina',
] as const

const paymentLineSchema = z
  .object({
    method: z.enum(EGRESO_PAYMENT_METHODS, { error: 'Selecciona una forma de pago' }),
    amount: moneyAmount,
    reference: z.string().optional(),
    bank: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // El backend exige `reference` (número de cheque) solo para este método.
    if (data.method === 'cheque' && !data.reference?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'El número de cheque es obligatorio',
        path: ['reference'],
      })
    }
  })

const baseSchema = z.object({
  supplierId: z.string().min(1, 'Selecciona un proveedor'),
  date: z.string().min(1, 'La fecha es requerida'),
  notes: z.string().optional(),
  payables: z.array(payableRowSchema),
  credits: z.array(creditRowSchema),
  payments: z.array(paymentLineSchema),
})

export type EgresoFormValues = z.infer<typeof baseSchema>

// Todo el cuadre (abonos, saldo a favor, formas de pago) se valida junto, igual que hace el
// backend en una sola transacción: si algo no cuadra acá, tampoco va a cuadrar allá.
export const egresoFormSchema = baseSchema.superRefine((data, ctx) => {
  const selectedPayables = data.payables.filter((p) => p.selected)

  if (selectedPayables.length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Selecciona al menos una cuenta por pagar',
      path: ['payables'],
    })
  }

  data.payables.forEach((p, index) => {
    if (!p.selected) return
    if (p.amount <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'El abono debe ser mayor que 0',
        path: ['payables', index, 'amount'],
      })
    } else if (p.amount > p.balance) {
      ctx.addIssue({
        code: 'custom',
        message: `No puede superar el saldo (${formatCOP(p.balance)})`,
        path: ['payables', index, 'amount'],
      })
    }
  })

  data.credits.forEach((c, index) => {
    if (c.amount > c.balance) {
      ctx.addIssue({
        code: 'custom',
        message: `No puede superar el saldo disponible (${formatCOP(c.balance)})`,
        path: ['credits', index, 'amount'],
      })
    }
  })

  const totalAbonos = selectedPayables.reduce((sum, p) => sum + p.amount, 0)
  const totalCredits = data.credits.reduce((sum, c) => sum + c.amount, 0)
  const totalPayments = data.payments.reduce((sum, p) => sum + p.amount, 0)
  const dineroAPagar = Math.max(totalAbonos - totalCredits, 0)

  if (totalCredits > totalAbonos) {
    ctx.addIssue({
      code: 'custom',
      message: 'El saldo a favor aplicado no puede superar el total de abonos',
      path: ['credits'],
    })
  }

  // Montos en pesos enteros: se compara redondeado para no fallar por residuos de coma
  // flotante (misma tolerancia que usa el backend con `toCents`).
  if (Math.round(totalPayments) !== Math.round(dineroAPagar)) {
    ctx.addIssue({
      code: 'custom',
      message: `Las formas de pago deben sumar ${formatCOP(dineroAPagar)}`,
      path: ['payments'],
    })
  }
})
