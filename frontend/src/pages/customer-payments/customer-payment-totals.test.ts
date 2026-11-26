import { describe, expect, it } from 'vitest'
import {
  calculateAllocationCash,
  calculateCreditPending,
  sumAmounts,
} from './customer-payment-totals'

describe('calculateAllocationCash', () => {
  it('resta saldo a favor y descuento de lo abonado', () => {
    expect(
      calculateAllocationCash({
        amount: '300000.00',
        creditAmount: '250000.00',
        discountAmount: '30000.00',
      }),
    ).toBe(20000)
  })

  it('en un recibo viejo sin reparto guardado devuelve null, no 0', () => {
    expect(
      calculateAllocationCash({ amount: '300000.00', creditAmount: null, discountAmount: '0' }),
    ).toBeNull()
  })
})

describe('sumAmounts', () => {
  it('suma los saldos a favor aplicados en centavos', () => {
    expect(sumAmounts([{ amount: '0.10' }, { amount: '0.20' }])).toBe(0.3)
  })
})

describe('calculateCreditPending', () => {
  it('abonos menos descuento y menos los otros saldos marcados, sin el propio', () => {
    expect(calculateCreditPending(500000, 50000, [100000, 200000], 0)).toBe(250000)
  })

  it('nunca es negativo', () => {
    expect(calculateCreditPending(100000, 20000, [0, 500000], 0)).toBe(0)
  })
})
