import { describe, expect, it } from 'vitest'
import { getAvailableStockHint, takesStockOut } from './available-stock'

describe('getAvailableStockHint', () => {
  it('alcanza: disponible en verde', () => {
    expect(getAvailableStockHint(10, 3)?.variant).toBe('positive')
    expect(getAvailableStockHint(3, 3)?.variant).toBe('positive')
  })

  it('no alcanza: aviso de que supera el disponible', () => {
    expect(getAvailableStockHint(2, 3)?.variant).toBe('warning')
  })

  it('disponible negativo (sobre-reservado): siempre aviso', () => {
    expect(getAvailableStockHint(-1, 0)?.variant).toBe('warning')
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
