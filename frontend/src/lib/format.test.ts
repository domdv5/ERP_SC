import { describe, expect, it } from 'vitest'
import {
  formatBogotaDate,
  formatBogotaDateLong,
  formatDateOnly,
  formatDateOnlyLong,
} from './format'

describe('formatDateOnlyLong', () => {
  it('muestra el día guardado en un @db.Date (medianoche UTC), no el anterior', () => {
    expect(formatDateOnlyLong('2026-11-06T00:00:00.000Z')).toBe('06 de noviembre de 2026')
  })
})

describe('formatBogotaDateLong', () => {
  it('muestra el día de Bogotá para un timestamp nocturno (22:30 del 6 en Bogotá)', () => {
    expect(formatBogotaDateLong('2026-11-07T03:30:00.000Z')).toBe('06 de noviembre de 2026')
  })
})

describe('formatDateOnly', () => {
  it('fecha corta sin cero a la izquierda ni punto en el mes, en el día guardado', () => {
    expect(formatDateOnly('2026-11-06T00:00:00.000Z')).toBe('6 nov 2026')
  })

  it('sin fecha muestra un guion', () => {
    expect(formatDateOnly(null)).toBe('—')
  })
})

describe('formatBogotaDate', () => {
  it('fecha corta en el día de Bogotá para un timestamp nocturno', () => {
    expect(formatBogotaDate('2026-11-07T03:30:00.000Z')).toBe('6 nov 2026')
  })
})
