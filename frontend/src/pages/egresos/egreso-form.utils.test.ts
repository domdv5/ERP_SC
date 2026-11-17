import { describe, expect, it } from 'vitest'
import { calculateFillCreditAmount } from './egreso-form.utils'

describe('calculateFillCreditAmount', () => {
  it('usa todo el saldo cuando alcanza para cubrir', () => {
    expect(calculateFillCreditAmount(200000, 500000, 0)).toBe(200000)
  })

  it('no pasa de lo que falta cubrir de los abonos', () => {
    expect(calculateFillCreditAmount(800000, 500000, 0)).toBe(500000)
  })

  it('descuenta lo que ya pusieron los otros saldos', () => {
    expect(calculateFillCreditAmount(300000, 500000, 350000)).toBe(150000)
  })

  it('devuelve 0, nunca negativo, si los otros saldos ya cubren todo', () => {
    expect(calculateFillCreditAmount(300000, 500000, 600000)).toBe(0)
  })
})
