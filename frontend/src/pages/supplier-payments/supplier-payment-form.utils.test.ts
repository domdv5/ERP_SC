import { describe, expect, it } from 'vitest'
import { calculateCreditPending } from './supplier-payment-form.utils'

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
