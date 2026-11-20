import { describe, expect, it } from 'vitest'
import { formatCOP } from '@/lib/format'
import { egresoFormSchema, type EgresoFormValues } from './egreso-form.schema'

const values = (creditAmount: number): EgresoFormValues => ({
  supplierId: 's1',
  date: '2026-11-20',
  payables: [{ accountPayableId: 'ap1', balance: 100000, selected: true, amount: 100000 }],
  credits: [{ supplierCreditId: 'sc1', balance: 50000, amount: creditAmount }],
  payments: [{ method: 'efectivo_oficina', amount: 100000 - creditAmount }],
})

const messages = (data: EgresoFormValues) => {
  const result = egresoFormSchema.safeParse(data)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

const partialMessage = `El saldo a favor se usa completo o no se usa. Saldo disponible: ${formatCOP(50000)}`

describe('egresoFormSchema — saldo a favor completo o nada', () => {
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
