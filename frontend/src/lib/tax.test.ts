import { describe, expect, it } from 'vitest'
import {
  OFFICIAL_TAX_PERCENT,
  computeOfficialLineTax,
  computeOfficialTotals,
  removeOfficialTax,
  splitOfficialPrice,
} from './tax'

describe('OFFICIAL_TAX_PERCENT', () => {
  it('es 19', () => {
    expect(OFFICIAL_TAX_PERCENT).toBe(19)
  })
})

describe('computeOfficialLineTax', () => {
  it('devuelve 0 con subtotal 0', () => {
    expect(computeOfficialLineTax(0)).toBe(0)
  })

  it('calcula el 19% exacto', () => {
    expect(computeOfficialLineTax(100)).toBe(19)
    expect(computeOfficialLineTax(1000)).toBe(190)
  })

  it('redondea a centavos', () => {
    expect(computeOfficialLineTax(10.5)).toBe(2)
    expect(computeOfficialLineTax(0.01)).toBe(0)
    expect(computeOfficialLineTax(0.03)).toBe(0.01)
    expect(computeOfficialLineTax(0.1)).toBe(0.02)
  })

  it('redondea .5 de centavo hacia arriba', () => {
    // 0.5 × 19 = 9.5 → 10 → 0.1
    expect(computeOfficialLineTax(0.5)).toBe(0.1)
  })

  it('con subtotal negativo redondea .5 hacia +infinito (Math.round)', () => {
    expect(computeOfficialLineTax(-100)).toBe(-19)
    expect(computeOfficialLineTax(-0.5)).toBe(-0.09)
  })
})

describe('removeOfficialTax', () => {
  it('devuelve 0 con valor 0', () => {
    expect(removeOfficialTax(0)).toBe(0)
  })

  it('quita el 19% y devuelve un entero', () => {
    expect(removeOfficialTax(119)).toBe(100)
    expect(removeOfficialTax(1190)).toBe(1000)
    expect(removeOfficialTax(11900)).toBe(10000)
  })

  it('redondea al peso más cercano', () => {
    // 1000 / 1.19 = 840.33
    expect(removeOfficialTax(1000)).toBe(840)
    // 1 / 1.19 = 0.84 → 1
    expect(removeOfficialTax(1)).toBe(1)
    // 0.5 / 1.19 = 0.42
    expect(removeOfficialTax(0.5)).toBe(0)
  })
})

describe('splitOfficialPrice', () => {
  it('línea en cero (cantidad 0 o precio 0)', () => {
    const zero = { subtotal: 0, taxAmount: 0, total: 0 }
    expect(splitOfficialPrice(0, 1190)).toEqual(zero)
    expect(splitOfficialPrice(5, 0)).toEqual(zero)
  })

  it('separa base e IVA de un precio con 1.19 exacto', () => {
    expect(splitOfficialPrice(1, 119)).toEqual({ subtotal: 100, taxAmount: 19, total: 119 })
    expect(splitOfficialPrice(2, 1190)).toEqual({ subtotal: 2000, taxAmount: 380, total: 2380 })
  })

  it('el total es exacto y base + IVA siempre suma el total', () => {
    const result = splitOfficialPrice(3, 1000)
    expect(result.total).toBe(3000)
    // 3000 / 1.19 = 2521.0084 → 2521.01
    expect(result.subtotal).toBe(2521.01)
    expect(result.taxAmount).toBe(478.99)
    expect(Math.round((result.subtotal + result.taxAmount) * 100)).toBe(300000)
  })

  it('soporta cantidades decimales', () => {
    // 1.5 × 100 = 150 → base 126.05, IVA 23.95
    expect(splitOfficialPrice(1.5, 100)).toEqual({ subtotal: 126.05, taxAmount: 23.95, total: 150 })
  })

  it('redondea el total de la línea a centavos', () => {
    expect(splitOfficialPrice(1, 0.004).total).toBe(0)
    expect(splitOfficialPrice(1, 0.005).total).toBe(0.01)
  })

  it('separa sobre el total de la línea, no por unidad', () => {
    // por unidad sería 100 × 0.01 de base = 1; sobre el total: 1 / 1.19 = 0.84
    expect(splitOfficialPrice(100, 0.01)).toEqual({ subtotal: 0.84, taxAmount: 0.16, total: 1 })
  })
})

describe('computeOfficialTotals', () => {
  it('lista vacía → todo en cero', () => {
    expect(computeOfficialTotals([])).toEqual({ subtotal: 0, taxTotal: 0, total: 0 })
  })

  it('una línea', () => {
    expect(computeOfficialTotals([{ quantity: 2, unitValue: 500 }])).toEqual({
      subtotal: 1000,
      taxTotal: 190,
      total: 1190,
    })
  })

  it('línea con cantidad o valor 0 aporta 0', () => {
    expect(
      computeOfficialTotals([
        { quantity: 0, unitValue: 500 },
        { quantity: 3, unitValue: 0 },
      ]),
    ).toEqual({ subtotal: 0, taxTotal: 0, total: 0 })
  })

  it('redondea el IVA por línea y luego suma, no sobre el subtotal global', () => {
    // Cada línea: 0.03 → IVA 0.01 (0.0057 → 0.01). Tres líneas: IVA 0.03.
    // Sobre el global (0.09): 0.09 × 19% = 0.0171 → 0.02.
    const lines = [
      { quantity: 1, unitValue: 0.03 },
      { quantity: 1, unitValue: 0.03 },
      { quantity: 1, unitValue: 0.03 },
    ]
    const result = computeOfficialTotals(lines)
    expect(result.taxTotal).toBeCloseTo(0.03, 10)
    expect(result.taxTotal).not.toBeCloseTo(0.02, 10)
  })

  it('redondea el subtotal de cada línea a centavos', () => {
    // 3 × 0.333 = 0.999 → 1.00
    const result = computeOfficialTotals([{ quantity: 3, unitValue: 0.333 }])
    expect(result.subtotal).toBe(1)
    expect(result.taxTotal).toBe(0.19)
  })

  it('total = subtotal + IVA con varias líneas', () => {
    const result = computeOfficialTotals([
      { quantity: 1, unitValue: 100 },
      { quantity: 2, unitValue: 250 },
    ])
    expect(result.subtotal).toBe(600)
    expect(result.taxTotal).toBe(114)
    expect(result.total).toBe(714)
  })
})
