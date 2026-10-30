import { describe, expect, it } from 'vitest'
import { formatCOP } from '@/lib/format'
import { reciboCajaFormSchema, type ReciboCajaFormValues } from './recibo-caja-form.schema'

const form = (overrides: Partial<ReciboCajaFormValues>): ReciboCajaFormValues => ({
  clientId: 'c1',
  customerBranchId: 'none',
  date: '2026-10-30',
  receivables: [{ accountReceivableId: 'ar1', balance: 100000, selected: true, amount: 100000 }],
  payments: [{ method: 'efectivo_oficina', amount: 90000 }],
  hasDiscount: true,
  discountReason: 'oferta',
  discountAmount: 10000,
  excedentes: [],
  ...overrides,
})

const messages = (values: ReciboCajaFormValues) => {
  const result = reciboCajaFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe('reciboCajaFormSchema — descuento', () => {
  it('acepta pagos + descuento que saldan la factura', () => {
    expect(messages(form({}))).toEqual([])
  })

  it('rechaza descuento con abono parcial', () => {
    const values = form({
      receivables: [{ accountReceivableId: 'ar1', balance: 100000, selected: true, amount: 60000 }],
      payments: [{ method: 'efectivo_oficina', amount: 50000 }],
    })
    expect(messages(values)).toContain(
      `El descuento solo aplica si se paga la factura completa. Abono requerido: ${formatCOP(100000)}`,
    )
  })

  it('exige motivo', () => {
    expect(messages(form({ discountReason: '' }))).toContain('Selecciona el motivo del descuento')
  })

  it('rechaza cubrir el 100% con Oferta', () => {
    expect(messages(form({ discountAmount: 100000, payments: [] }))).toContain(
      'Solo Castigo de Cartera o Mercancía Extraviada pueden cubrir el total de la deuda',
    )
  })

  it('acepta cubrir el 100% sin pagos con Castigo de Cartera', () => {
    expect(
      messages(form({ discountReason: 'castigo_cartera', discountAmount: 100000, payments: [] })),
    ).toEqual([])
  })

  it('rechaza descuento mayor que la deuda', () => {
    expect(
      messages(form({ discountReason: 'castigo_cartera', discountAmount: 120000, payments: [] })),
    ).toContain(`El descuento no puede superar la deuda (${formatCOP(100000)})`)
  })

  it('exige que los pagos sumen la deuda menos el descuento', () => {
    expect(messages(form({ payments: [{ method: 'efectivo_oficina', amount: 95000 }] }))).toContain(
      `Las formas de pago deben sumar ${formatCOP(90000)}`,
    )
  })

  it('sin descuento ignora los campos de descuento y permite abono parcial', () => {
    const values = form({
      hasDiscount: false,
      discountReason: '',
      discountAmount: 0,
      receivables: [{ accountReceivableId: 'ar1', balance: 100000, selected: true, amount: 60000 }],
      payments: [{ method: 'efectivo_oficina', amount: 60000 }],
    })
    expect(messages(values)).toEqual([])
  })
})

describe('reciboCajaFormSchema — excedentes', () => {
  const base = {
    hasDiscount: false,
    discountReason: '' as const,
    discountAmount: 0,
  }

  it('los excedentes cuentan como pago', () => {
    const values = form({
      ...base,
      payments: [{ method: 'efectivo_oficina', amount: 70000 }],
      excedentes: [{ customerCreditId: 'cc1', balance: 50000, amount: 30000 }],
    })
    expect(messages(values)).toEqual([])
  })

  it('un excedente puede cubrir todo sin formas de pago', () => {
    const values = form({
      ...base,
      payments: [],
      excedentes: [{ customerCreditId: 'cc1', balance: 100000, amount: 100000 }],
    })
    expect(messages(values)).toEqual([])
  })

  it('no deja usar más que el saldo del excedente', () => {
    const values = form({
      ...base,
      payments: [{ method: 'efectivo_oficina', amount: 40000 }],
      excedentes: [{ customerCreditId: 'cc1', balance: 50000, amount: 60000 }],
    })
    expect(messages(values)).toContain(
      `No puede superar el saldo del excedente (${formatCOP(50000)})`,
    )
  })

  it('exige que pagos + excedentes cuadren con la deuda', () => {
    const values = form({
      ...base,
      payments: [{ method: 'efectivo_oficina', amount: 80000 }],
      excedentes: [{ customerCreditId: 'cc1', balance: 50000, amount: 30000 }],
    })
    expect(messages(values)).toContain(`Las formas de pago deben sumar ${formatCOP(70000)}`)
  })

  it('rechaza excedentes que superan la deuda', () => {
    const values = form({
      ...base,
      payments: [],
      excedentes: [{ customerCreditId: 'cc1', balance: 200000, amount: 150000 }],
    })
    expect(messages(values)).toContain(
      `Los excedentes y el descuento superan la deuda (${formatCOP(100000)})`,
    )
  })
})
