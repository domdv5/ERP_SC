import { describe, expect, it } from 'vitest'
import { checkPasswordRule, isValidPassword, PASSWORD_RULE_MESSAGE } from './password-rule'

describe('checkPasswordRule', () => {
  it('marca cada parte de la regla por separado', () => {
    expect(checkPasswordRule('abc')).toEqual([
      { label: 'Mínimo 8 caracteres', met: false },
      { label: 'Al menos una letra', met: true },
      { label: 'Al menos un número', met: false },
    ])
  })

  it('cumple todo con 8 caracteres, letras y números', () => {
    expect(checkPasswordRule('abcd1234').every((r) => r.met)).toBe(true)
  })

  it('vacía no cumple nada', () => {
    expect(checkPasswordRule('').some((r) => r.met)).toBe(false)
  })
})

describe('isValidPassword', () => {
  it.each([
    ['abcd1234', true],
    ['abc1234', false],
    ['12345678', false],
    ['abcdefgh', false],
    ['Ñandú2026', true],
  ])('%s → %s', (password, expected) => {
    expect(isValidPassword(password)).toBe(expected)
  })

  it('usa el mismo mensaje que el backend', () => {
    expect(PASSWORD_RULE_MESSAGE).toBe(
      'La contraseña debe tener al menos 8 caracteres, con letras y números',
    )
  })
})
