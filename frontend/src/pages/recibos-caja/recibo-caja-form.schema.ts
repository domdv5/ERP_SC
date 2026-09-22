import { z } from 'zod'
import { formatCOP } from '@/lib/format'

// El input con separador de miles (ThousandsInput) devuelve vacío como `undefined`; se trata
// como 0 para que la validación siempre sume números.
const moneyAmount = z.preprocess(
  (v) => (v == null ? 0 : v),
  z.number().min(0, 'El monto no puede ser negativo'),
)

// `balance` viaja en cada fila solo para validar en el cliente que no se abone más de lo
// disponible; se descarta antes de armar el payload real.
const receivableRowSchema = z.object({
  accountReceivableId: z.string(),
  balance: z.coerce.number(),
  selected: z.boolean(),
  amount: moneyAmount,
})

export const RECIBO_CAJA_PAYMENT_METHODS = [
  'efectivo_almacen',
  'consignacion_almacen',
  'cheque',
  'efectivo_oficina',
  'consignacion_oficina',
] as const

const paymentLineSchema = z
  .object({
    method: z.enum(RECIBO_CAJA_PAYMENT_METHODS, { error: 'Selecciona una forma de pago' }),
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
  clientId: z.string().min(1, 'Selecciona un cliente'),
  date: z.string().min(1, 'La fecha es requerida'),
  notes: z.string().optional(),
  receivables: z.array(receivableRowSchema),
  payments: z.array(paymentLineSchema),
})

export type ReciboCajaFormValues = z.infer<typeof baseSchema>

// Cuadre exacto (sin saldo a favor): se valida junto, igual que hace el backend en una sola
// transacción — si algo no cuadra acá, tampoco va a cuadrar allá.
export const reciboCajaFormSchema = baseSchema.superRefine((data, ctx) => {
  const selectedReceivables = data.receivables.filter((r) => r.selected)

  if (selectedReceivables.length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Selecciona al menos una cuenta por cobrar',
      path: ['receivables'],
    })
  }

  data.receivables.forEach((r, index) => {
    if (!r.selected) return
    if (r.amount <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'El abono debe ser mayor que 0',
        path: ['receivables', index, 'amount'],
      })
    } else if (r.amount > r.balance) {
      ctx.addIssue({
        code: 'custom',
        message: `No puede superar el saldo (${formatCOP(r.balance)})`,
        path: ['receivables', index, 'amount'],
      })
    }
  })

  const totalAbonos = selectedReceivables.reduce((sum, r) => sum + r.amount, 0)
  const totalPayments = data.payments.reduce((sum, p) => sum + p.amount, 0)

  // Montos en pesos enteros: se compara redondeado para no fallar por residuos de coma
  // flotante (misma tolerancia que usa el backend con `toCents`).
  if (Math.round(totalPayments) !== Math.round(totalAbonos)) {
    ctx.addIssue({
      code: 'custom',
      message: `Las formas de pago deben sumar ${formatCOP(totalAbonos)}`,
      path: ['payments'],
    })
  }
})
