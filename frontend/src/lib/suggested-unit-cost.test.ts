import { describe, expect, it } from 'vitest'
import { suggestedUnitCost } from './suggested-unit-cost'

const product = { avgCost: '14558.285', lastCost: '15000' }

describe('suggestedUnitCost', () => {
  it('la compra sugiere el último costo de compra', () => {
    expect(suggestedUnitCost('CM', product)).toBe(15000)
  })

  it('la compra de un producto nunca comprado queda vacía', () => {
    expect(suggestedUnitCost('CM', { avgCost: '14558.285', lastCost: '0' })).toBeUndefined()
  })

  it.each(['DVC', 'EAI'] as const)('%s sugiere el costo promedio en pesos enteros', (type) => {
    expect(suggestedUnitCost(type, product)).toBe(14558)
  })

  it('redondea al peso más cercano un último costo con decimales', () => {
    expect(suggestedUnitCost('CM', { avgCost: '0', lastCost: '15000.6' })).toBe(15001)
  })

  it('sin costo promedio no sugiere nada', () => {
    expect(suggestedUnitCost('EAI', { avgCost: '0', lastCost: '15000' })).toBeUndefined()
  })

  it.each(['CMO', 'T', 'SAJ', 'PV'] as const)('%s no sugiere costo', (type) => {
    expect(suggestedUnitCost(type, product)).toBeUndefined()
  })
})
