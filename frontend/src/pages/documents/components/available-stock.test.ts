import { describe, expect, it } from 'vitest'
import { getAvailableStockHint, takesStockOut } from './available-stock'

describe('getAvailableStockHint', () => {
  it('alcanza: disponible en verde', () => {
    expect(getAvailableStockHint(10, 3)).toEqual({ variant: 'positive', text: 'Disponible: 10' })
    expect(getAvailableStockHint(3, 3)).toEqual({ variant: 'positive', text: 'Disponible: 3' })
  })

  it('no alcanza: aviso de que supera el disponible', () => {
    expect(getAvailableStockHint(2, 3)).toEqual({
      variant: 'warning',
      text: 'Supera el disponible (2)',
    })
  })

  it('disponible negativo (sobre-reservado): siempre aviso', () => {
    expect(getAvailableStockHint(-1, 0)).toEqual({
      variant: 'warning',
      text: 'Supera el disponible (-1)',
    })
  })

  it('sin dato de disponible no muestra nada', () => {
    expect(getAvailableStockHint(null, 3)).toBeNull()
    expect(getAvailableStockHint(undefined, 3)).toBeNull()
  })
})

describe('takesStockOut', () => {
  it('los documentos que sacan mercancía muestran el disponible', () => {
    for (const type of ['PV', 'REM', 'T', 'SAJ', 'DVC', 'POS', 'COT', 'POSO'] as const) {
      expect(takesStockOut(type)).toBe(true)
    }
  })

  it('los documentos que entran mercancía no', () => {
    for (const type of ['CM', 'CMO', 'EAI', 'DVV'] as const) {
      expect(takesStockOut(type)).toBe(false)
    }
  })
})
