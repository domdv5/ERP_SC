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

export const RECIBO_CAJA_PAYMENT_METHODS = ['efectivo_oficina', 'consignacion_oficina'] as const

const paymentLineSchema = z.object({
  method: z.enum(RECIBO_CAJA_PAYMENT_METHODS, { error: 'Selecciona una forma de pago' }),
  amount: moneyAmount,
  reference: z.string().optional(),
  bank: z.string().optional(),
})

export const RECIBO_CAJA_DISCOUNT_REASONS = [
  'descuento_comercial',
  'oferta',
  'donacion',
  'fidelizacion',
  'mercancia_extraviada',
  'castigo_cartera',
  'promocion',
] as const

export type ReciboCajaDiscountReason = (typeof RECIBO_CAJA_DISCOUNT_REASONS)[number]

export const RECIBO_CAJA_DISCOUNT_REASON_LABELS: Record<ReciboCajaDiscountReason, string> = {
  descuento_comercial: 'Descuento Comercial',
  oferta: 'Oferta',
  donacion: 'Donación',
  fidelizacion: 'Fidelización',
  mercancia_extraviada: 'Mercancía Extraviada',
  castigo_cartera: 'Castigo de Cartera',
  promocion: 'Promoción',
}

// Únicos motivos que pueden saldar toda la deuda sin que entre dinero (mismo criterio que el backend).
export const FULL_COVER_DISCOUNT_REASONS: readonly ReciboCajaDiscountReason[] = [
  'castigo_cartera',
  'mercancia_extraviada',
]

// Excedente disponible de la sucursal; amount 0 = no se usa en este recibo.
const excedenteRowSchema = z.object({
  customerCreditId: z.string(),
  balance: z.coerce.number(),
  amount: moneyAmount,
})

const baseSchema = z.object({
  clientId: z.string().min(1, 'Selecciona un cliente'),
  // '' = sin elegir, 'none' = facturas sin sucursal
  customerBranchId: z.string(),
  date: z.string().min(1, 'La fecha es requerida'),
  notes: z.string().optional(),
  receivables: z.array(receivableRowSchema),
  payments: z.array(paymentLineSchema),
  hasDiscount: z.boolean(),
  // '' = sin elegir
  discountReason: z.union([z.enum(RECIBO_CAJA_DISCOUNT_REASONS), z.literal('')]),
  discountAmount: moneyAmount,
  excedentes: z.array(excedenteRowSchema),
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
    } else if (data.hasDiscount && Math.round(r.amount) !== Math.round(r.balance)) {
      // El descuento solo se da sobre el total: no existe descuento en abonos parciales.
      ctx.addIssue({
        code: 'custom',
        message: `El descuento solo aplica si se paga la factura completa. Abono requerido: ${formatCOP(r.balance)}`,
        path: ['receivables', index, 'amount'],
      })
    }
  })

  const totalAbonos = selectedReceivables.reduce((sum, r) => sum + r.amount, 0)
  const totalPayments = data.payments.reduce((sum, p) => sum + p.amount, 0)
  const discount = data.hasDiscount ? data.discountAmount : 0

  data.excedentes.forEach((e, index) => {
    if (Math.round(e.amount) > Math.round(e.balance)) {
      ctx.addIssue({
        code: 'custom',
        message: `No puede superar el saldo del excedente (${formatCOP(e.balance)})`,
        path: ['excedentes', index, 'amount'],
      })
    }
  })
  const totalExcedentes = data.excedentes.reduce((sum, e) => sum + e.amount, 0)

  if (data.hasDiscount) {
    if (data.discountReason === '') {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona el motivo del descuento',
        path: ['discountReason'],
      })
    }
    if (discount <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'El descuento debe ser mayor que 0',
        path: ['discountAmount'],
      })
    } else if (Math.round(discount) > Math.round(totalAbonos)) {
      ctx.addIssue({
        code: 'custom',
        message: `El descuento no puede superar la deuda (${formatCOP(totalAbonos)})`,
        path: ['discountAmount'],
      })
    } else if (
      Math.round(discount) === Math.round(totalAbonos) &&
      data.discountReason !== '' &&
      !FULL_COVER_DISCOUNT_REASONS.includes(data.discountReason)
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Solo Castigo de Cartera o Mercancía Extraviada pueden cubrir el total de la deuda',
        path: ['discountAmount'],
      })
    }
  }

  // Montos en pesos enteros: se compara redondeado para no fallar por residuos de coma
  // flotante (misma tolerancia que usa el backend con `toCents`).
  const expectedPayments = totalAbonos - discount - totalExcedentes
  if (Math.round(expectedPayments) < 0) {
    ctx.addIssue({
      code: 'custom',
      message: `Los excedentes y el descuento superan la deuda (${formatCOP(totalAbonos)})`,
      path: ['excedentes'],
    })
  }
  if (Math.round(totalPayments) !== Math.round(expectedPayments)) {
    ctx.addIssue({
      code: 'custom',
      message: `Las formas de pago deben sumar ${formatCOP(expectedPayments)}`,
      path: ['payments'],
    })
  }
})
