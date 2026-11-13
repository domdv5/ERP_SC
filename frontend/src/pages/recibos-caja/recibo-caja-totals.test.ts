import { describe, expect, it } from 'vitest'
import { calculateAllocationCash, calculateReciboTotal, sumAmounts } from './recibo-caja-totals'

describe('calculateReciboTotal', () => {
  it('suma dinero recibido, saldo a favor y descuento', () => {
    expect(
      calculateReciboTotal({
        cashTotal: '650000.00',
        creditTotal: '250000.00',
        discountAmount: '100000.00',
      }),
    ).toBe(1000000)
  })

  it('sin saldo ni descuento es igual al dinero recibido', () => {
    expect(
      calculateReciboTotal({ cashTotal: '70000.00', creditTotal: '0', discountAmount: '0' }),
    ).toBe(70000)
  })

  it('suma centavos sin error de redondeo', () => {
    expect(
      calculateReciboTotal({ cashTotal: '0.10', creditTotal: '0.20', discountAmount: '0.00' }),
    ).toBe(0.3)
  })
})

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
