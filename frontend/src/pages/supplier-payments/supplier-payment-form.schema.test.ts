import { describe, expect, it } from 'vitest'
import { formatCOP } from '@/lib/format'
import {
  supplierPaymentFormSchema,
  type SupplierPaymentFormValues,
} from './supplier-payment-form.schema'

const values = (creditAmount: number): SupplierPaymentFormValues => ({
  supplierId: 's1',
  date: '2026-11-20',
  payables: [{ accountPayableId: 'ap1', balance: 100000, selected: true, amount: 100000 }],
  credits: [{ supplierCreditId: 'sc1', balance: 50000, amount: creditAmount }],
  payments: [{ method: 'efectivo_oficina', amount: 100000 - creditAmount }],
})

const messages = (data: SupplierPaymentFormValues) => {
  const result = supplierPaymentFormSchema.safeParse(data)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

const overflowMessage = 'El saldo a favor es mayor que lo pendiente: aumenta el abono o desmárcalo'

const partialMessage = `El saldo a favor se usa completo o no se usa. Saldo disponible: ${formatCOP(50000)}`

describe('supplierPaymentFormSchema — saldo marcado que no cabe', () => {
  it('marca error en la fila del primer saldo que desborda y valida de nuevo al subir el abono', () => {
    const data = values(50000)
    data.payables = [{ accountPayableId: 'ap1', balance: 100000, selected: true, amount: 40000 }]
    data.payments = []
    const result = supplierPaymentFormSchema.safeParse(data)
    const issue = result.success
      ? undefined
      : result.error.issues.find((i) => i.message === overflowMessage)
    expect(issue?.path).toEqual(['credits', 0, 'amount'])

    data.payables[0].amount = 100000
    data.payments = [{ method: 'efectivo_oficina', amount: 50000 }]
    expect(messages(data)).not.toContain(overflowMessage)
  })
})

describe('supplierPaymentFormSchema — saldo a favor completo o nada', () => {
  it('rechaza un saldo a favor usado a medias', () => {
    expect(messages(values(30000))).toContain(partialMessage)
  })

  it('acepta el saldo a favor completo', () => {
    expect(messages(values(50000))).not.toContain(partialMessage)
  })
  it('compara en centavos: 2000.4 contra un saldo de 2000 se rechaza', () => {
    const data = values(50000)
    data.credits = [{ supplierCreditId: 'sc1', balance: 2000, amount: 2000.4 }]
    expect(messages(data)).toContain(
      `El saldo a favor se usa completo o no se usa. Saldo disponible: ${formatCOP(2000)}`,
    )
  })
})
