import { describe, expect, it } from 'vitest'
import { calculateReciboTotal } from './recibo-caja-totals'

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
