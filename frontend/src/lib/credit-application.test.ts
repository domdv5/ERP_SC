import { describe, expect, it } from 'vitest'
import { canUseCredit, findCreditOverflowIndex, suggestCreditAmounts } from './credit-application'

describe('suggestCreditAmounts', () => {
  it('lista vacía → vacío', () => {
    expect(suggestCreditAmounts([], 100)).toEqual([])
  })

  it('total 0 o negativo → vacío', () => {
    const credits = [{ id: 'a', balance: 50 }]
    expect(suggestCreditAmounts(credits, 0)).toEqual([])
    expect(suggestCreditAmounts(credits, -10)).toEqual([])
  })

  it('un saldo mayor al total no se sugiere (no se divide)', () => {
    expect(suggestCreditAmounts([{ id: 'a', balance: 500 }], 120)).toEqual([])
  })

  it('un saldo menor o igual al total se sugiere completo', () => {
    expect(suggestCreditAmounts([{ id: 'a', balance: 50 }], 120)).toEqual([{ id: 'a', amount: 50 }])
    expect(suggestCreditAmounts([{ id: 'a', balance: 120 }], 120)).toEqual([
      { id: 'a', amount: 120 },
    ])
  })

  it('en el orden recibido toma los saldos completos que caben y salta los que no', () => {
    const credits = [
      { id: 'a', balance: 50 },
      { id: 'b', balance: 70 },
      { id: 'c', balance: 30 },
    ]
    expect(suggestCreditAmounts(credits, 100)).toEqual([
      { id: 'a', amount: 50 },
      { id: 'c', amount: 30 },
    ])
  })

  it('salta saldos en 0 o negativos', () => {
    const credits = [
      { id: 'a', balance: 0 },
      { id: 'b', balance: -5 },
      { id: 'c', balance: 40 },
    ]
    expect(suggestCreditAmounts(credits, 100)).toEqual([{ id: 'c', amount: 40 }])
  })
})

describe('canUseCredit', () => {
  it('se puede usar si el saldo es menor o igual a lo pendiente', () => {
    expect(canUseCredit(50, 100)).toBe(true)
    expect(canUseCredit(100, 100)).toBe(true)
  })

  it('no se puede usar si el saldo es mayor que lo pendiente', () => {
    expect(canUseCredit(100.01, 100)).toBe(false)
    expect(canUseCredit(50, 0)).toBe(false)
  })

  it('un saldo en 0 no se puede usar', () => {
    expect(canUseCredit(0, 100)).toBe(false)
  })

  it('compara en centavos, sin errores de coma flotante', () => {
    expect(canUseCredit(0.3, 0.1 + 0.2)).toBe(true)
  })
})

describe('findCreditOverflowIndex', () => {
  it('todos caben → -1', () => {
    expect(findCreditOverflowIndex([40, 60], 100)).toBe(-1)
  })

  it('devuelve el primer saldo marcado que hace pasar la suma de lo pendiente', () => {
    expect(findCreditOverflowIndex([40, 30, 50], 100)).toBe(2)
  })

  it('ignora los saldos sin marcar (monto 0)', () => {
    expect(findCreditOverflowIndex([0, 120, 0], 100)).toBe(1)
    expect(findCreditOverflowIndex([0, 0], 0)).toBe(-1)
  })

  it('compara en centavos, sin errores de coma flotante', () => {
    expect(findCreditOverflowIndex([0.1, 0.2], 0.3)).toBe(-1)
  })
})
