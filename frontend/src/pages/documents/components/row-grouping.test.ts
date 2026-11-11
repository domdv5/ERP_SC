import { describe, expect, it } from 'vitest'
import {
  findRowIndexToAdd,
  findRowIndexToPick,
  separatesRows,
  sumQuantityByProduct,
} from './row-grouping'

const rows = [{ productId: 'A' }, { productId: 'B' }, { productId: '' }]

describe('separatesRows', () => {
  it('REM, COT, POS, POSO y DVV separan filas; el resto agrupa', () => {
    for (const type of ['REM', 'COT', 'POS', 'POSO', 'DVV'] as const) {
      expect(separatesRows(type)).toBe(true)
    }
    for (const type of ['CM', 'T', 'EAI', 'SAJ', 'PV', 'DVC', 'CMO'] as const) {
      expect(separatesRows(type)).toBe(false)
    }
  })
})

describe('findRowIndexToAdd', () => {
  it('tipo que separa: solo agrupa con la última fila', () => {
    expect(findRowIndexToAdd(rows.slice(0, 2), 'POS', 'B')).toBe(1)
    expect(findRowIndexToAdd(rows.slice(0, 2), 'POS', 'A')).toBe(-1)
    expect(findRowIndexToAdd([], 'POS', 'A')).toBe(-1)
  })

  it('tipo que agrupa: busca en todas las filas', () => {
    expect(findRowIndexToAdd(rows, 'CM', 'A')).toBe(0)
  })
})

describe('findRowIndexToPick', () => {
  it('tipo que separa: agrupa solo con la fila anterior', () => {
    expect(findRowIndexToPick(rows, 'REM', 'B', 2)).toBe(1)
    expect(findRowIndexToPick(rows, 'REM', 'A', 2)).toBe(-1)
    expect(findRowIndexToPick(rows, 'REM', 'A', 0)).toBe(-1)
  })

  it('tipo que agrupa: busca en las demás filas, nunca en la propia', () => {
    expect(findRowIndexToPick(rows, 'CM', 'A', 2)).toBe(0)
    expect(findRowIndexToPick([{ productId: 'A' }], 'CM', 'A', 0)).toBe(-1)
  })
})

describe('sumQuantityByProduct', () => {
  it('suma todas las filas del mismo producto', () => {
    const items = [
      { productId: 'A', quantity: 2 },
      { productId: 'B', quantity: 1 },
      { productId: 'A', quantity: '3' },
    ]
    expect(sumQuantityByProduct(items, 'A')).toBe(5)
    expect(sumQuantityByProduct(items, undefined)).toBe(0)
  })
})
