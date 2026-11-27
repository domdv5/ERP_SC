import { describe, expect, it } from 'vitest'
import {
  calculateCreditPending,
  formatSupplierCreditDate,
  getExcessCreditLabel,
} from './supplier-payment-form.utils'

describe('calculateCreditPending', () => {
  it('sin otros saldos marcados, lo pendiente son todos los abonos', () => {
    expect(calculateCreditPending(500000, [0, 0], 0)).toBe(500000)
  })

  it('descuenta lo que ya cubren los otros saldos marcados, no el propio', () => {
    expect(calculateCreditPending(500000, [300000, 150000], 0)).toBe(350000)
  })

  it('devuelve 0, nunca negativo, si los otros saldos ya cubren todo', () => {
    expect(calculateCreditPending(500000, [0, 600000], 0)).toBe(0)
  })
})

const excessCredit = {
  kind: 'excedente' as const,
  number: '12',
  date: '2026-11-20',
  createdAt: '2026-11-27T15:00:00.000Z',
}
const returnCredit = {
  kind: 'devolucion' as const,
  number: null,
  date: null,
  createdAt: '2026-11-27T15:00:00.000Z',
}

describe('getExcessCreditLabel', () => {
  it('un excedente se identifica con su consecutivo EXC', () => {
    expect(getExcessCreditLabel(excessCredit)).toBe('EXC-000012')
  })

  it('una devolución no tiene etiqueta de excedente', () => {
    expect(getExcessCreditLabel(returnCredit)).toBeNull()
  })
})

describe('formatSupplierCreditDate', () => {
  it('el excedente muestra su propia fecha, no la de creación', () => {
    expect(formatSupplierCreditDate(excessCredit)).toBe('20 nov 2026')
  })

  it('la devolución usa la fecha de creación', () => {
    expect(formatSupplierCreditDate(returnCredit)).toBe('27 nov 2026')
  })
})
