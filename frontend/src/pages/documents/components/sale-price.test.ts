import { describe, expect, it } from 'vitest'
import { prefillsSalePrice } from './sale-price'

describe('prefillsSalePrice', () => {
  it('al pistolear en REM y DVV se carga el precio de venta', () => {
    expect(prefillsSalePrice('REM')).toBe(true)
    expect(prefillsSalePrice('DVV')).toBe(true)
  })

  it('PV, POS, COT y POSO siguen cargando el precio de venta', () => {
    for (const type of ['PV', 'POS', 'COT', 'POSO'] as const) {
      expect(prefillsSalePrice(type)).toBe(true)
    }
  })

  it('compras, traslados y ajustes no cargan precio de venta', () => {
    for (const type of ['CM', 'CMO', 'T', 'EAI', 'SAJ', 'DVC'] as const) {
      expect(prefillsSalePrice(type)).toBe(false)
    }
  })
})
