import { describe, expect, it } from 'vitest'
import { formatPaymentDays } from './accounts-receivable.utils'

describe('formatPaymentDays', () => {
  it('usa singular para un día', () => {
    expect(formatPaymentDays(1)).toBe('1 día')
  })

  it('usa plural para cero y varios días', () => {
    expect(formatPaymentDays(0)).toBe('0 días')
    expect(formatPaymentDays(58)).toBe('58 días')
  })
})
