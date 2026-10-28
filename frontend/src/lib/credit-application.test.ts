import { describe, expect, it } from 'vitest'
import { limitCreditAmount, limitCreditsToTotal, suggestCreditAmounts } from './credit-application'

describe('suggestCreditAmounts', () => {
  it('lista vacía → vacío', () => {
    expect(suggestCreditAmounts([], 100)).toEqual([])
  })

  it('total 0 o negativo → vacío', () => {
    const credits = [{ id: 'a', balance: 50 }]
    expect(suggestCreditAmounts(credits, 0)).toEqual([])
    expect(suggestCreditAmounts(credits, -10)).toEqual([])
  })

  it('un saldo mayor al total aplica solo el total', () => {
    expect(suggestCreditAmounts([{ id: 'a', balance: 500 }], 120)).toEqual([
      { id: 'a', amount: 120 },
    ])
  })

  it('un saldo menor al total aplica todo el saldo', () => {
    expect(suggestCreditAmounts([{ id: 'a', balance: 50 }], 120)).toEqual([{ id: 'a', amount: 50 }])
  })

  it('reparte en el orden recibido hasta cubrir el total y deja el resto sin tocar', () => {
    const credits = [
      { id: 'a', balance: 50 },
      { id: 'b', balance: 70 },
      { id: 'c', balance: 90 },
    ]
    expect(suggestCreditAmounts(credits, 100)).toEqual([
      { id: 'a', amount: 50 },
      { id: 'b', amount: 50 },
    ])
  })

  it('total exacto a la suma de saldos usa todos', () => {
    const credits = [
      { id: 'a', balance: 50 },
      { id: 'b', balance: 70 },
    ]
    expect(suggestCreditAmounts(credits, 120)).toEqual([
      { id: 'a', amount: 50 },
      { id: 'b', amount: 70 },
    ])
  })

  it('total mayor a la suma de saldos aplica todos y no inventa más', () => {
    expect(suggestCreditAmounts([{ id: 'a', balance: 50 }], 1000)).toEqual([
      { id: 'a', amount: 50 },
    ])
  })

  it('salta saldos en 0 o negativos', () => {
    const credits = [
      { id: 'a', balance: 0 },
      { id: 'b', balance: -5 },
      { id: 'c', balance: 30 },
    ]
    expect(suggestCreditAmounts(credits, 100)).toEqual([{ id: 'c', amount: 30 }])
  })
})

describe('limitCreditAmount', () => {
  it('NaN → 0', () => {
    expect(limitCreditAmount(Number.NaN, 100, 100, 0)).toBe(0)
  })

  it('negativo → 0', () => {
    expect(limitCreditAmount(-1, 100, 100, 0)).toBe(0)
  })

  it('0 → 0', () => {
    expect(limitCreditAmount(0, 100, 100, 0)).toBe(0)
  })

  it('respeta el valor si está dentro de todos los topes', () => {
    expect(limitCreditAmount(40, 100, 100, 0)).toBe(40)
  })

  it('no pasa del propio saldo', () => {
    expect(limitCreditAmount(80, 50, 1000, 0)).toBe(50)
  })

  it('no hace que la suma con los demás supere el total', () => {
    expect(limitCreditAmount(80, 500, 100, 70)).toBe(30)
  })

  it('si los demás ya cubren el total → 0', () => {
    expect(limitCreditAmount(10, 500, 100, 100)).toBe(0)
    expect(limitCreditAmount(10, 500, 100, 150)).toBe(0)
  })

  it('total 0 o negativo → 0', () => {
    expect(limitCreditAmount(10, 500, 0, 0)).toBe(0)
    expect(limitCreditAmount(10, 500, -20, 0)).toBe(0)
  })

  it('saldo en 0 → 0', () => {
    expect(limitCreditAmount(10, 0, 100, 0)).toBe(0)
  })

  it('en el tope exacto lo deja pasar', () => {
    expect(limitCreditAmount(30, 500, 100, 70)).toBe(30)
  })
})

describe('limitCreditsToTotal', () => {
  it('lista vacía → vacío', () => {
    expect(limitCreditsToTotal([], 100)).toEqual([])
  })

  it('total 0 o negativo → vacío', () => {
    const credits = [{ id: 'a', amount: 10 }]
    expect(limitCreditsToTotal(credits, 0)).toEqual([])
    expect(limitCreditsToTotal(credits, -5)).toEqual([])
  })

  it('si la suma cabe en el total no cambia nada', () => {
    const credits = [
      { id: 'a', amount: 30 },
      { id: 'b', amount: 20 },
    ]
    expect(limitCreditsToTotal(credits, 100)).toEqual(credits)
  })

  it('recorta desde el último cuando la suma supera el total', () => {
    const credits = [
      { id: 'a', amount: 60 },
      { id: 'b', amount: 60 },
    ]
    expect(limitCreditsToTotal(credits, 100)).toEqual([
      { id: 'a', amount: 60 },
      { id: 'b', amount: 40 },
    ])
  })

  it('descarta los saldos que quedan sin presupuesto', () => {
    const credits = [
      { id: 'a', amount: 60 },
      { id: 'b', amount: 60 },
      { id: 'c', amount: 60 },
    ]
    expect(limitCreditsToTotal(credits, 60)).toEqual([{ id: 'a', amount: 60 }])
  })

  it('descarta montos en 0 o negativos', () => {
    const credits = [
      { id: 'a', amount: 0 },
      { id: 'b', amount: -3 },
      { id: 'c', amount: 10 },
    ]
    expect(limitCreditsToTotal(credits, 100)).toEqual([{ id: 'c', amount: 10 }])
  })

  it('conserva las demás propiedades del elemento y no muta la entrada', () => {
    const credits = [{ id: 'a', amount: 60, note: 'x' }]
    const result = limitCreditsToTotal(credits, 25)
    expect(result).toEqual([{ id: 'a', amount: 25, note: 'x' }])
    expect(credits[0].amount).toBe(60)
  })
})
