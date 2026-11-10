import { describe, expect, it } from 'vitest'
import { findApiErrorMessage, getApiErrorMessage } from './api-error'

const withMessage = (message: unknown) => ({ response: { data: { message } } })

describe('getApiErrorMessage', () => {
  it('returns the backend message when it is a string', () => {
    expect(getApiErrorMessage(withMessage('El usuario ya existe'), 'Error')).toBe(
      'El usuario ya existe',
    )
  })

  it('returns the first message when the backend sends a list', () => {
    expect(
      getApiErrorMessage(withMessage(['each value in roleIds must be a UUID', 'otro']), 'Error'),
    ).toBe('each value in roleIds must be a UUID')
  })

  it('returns the fallback when there is no usable message', () => {
    expect(getApiErrorMessage(new Error('Network Error'), 'Error al guardar')).toBe(
      'Error al guardar',
    )
    expect(getApiErrorMessage(withMessage([]), 'Error al guardar')).toBe('Error al guardar')
    expect(getApiErrorMessage(withMessage(''), 'Error al guardar')).toBe('Error al guardar')
  })
})

describe('findApiErrorMessage', () => {
  it('returns the backend message when it is a string', () => {
    expect(findApiErrorMessage(withMessage('El usuario ya existe'))).toBe('El usuario ya existe')
  })

  it('returns the first message when the backend sends a list', () => {
    expect(findApiErrorMessage(withMessage(['primero', 'segundo']))).toBe('primero')
  })

  it('returns undefined when there is no usable message', () => {
    expect(findApiErrorMessage(new Error('Network Error'))).toBeUndefined()
    expect(findApiErrorMessage(withMessage([]))).toBeUndefined()
    expect(findApiErrorMessage(withMessage(''))).toBeUndefined()
  })
})
