import { describe, expect, it } from 'vitest'
import { canViewDocument } from './document-permissions'

describe('canViewDocument', () => {
  it('ve un tipo que crea', () => {
    expect(canViewDocument('T', ['document.create.T'])).toBe(true)
  })

  it('ve un tipo que solo convierte', () => {
    expect(canViewDocument('PV', ['document.convert.PV'])).toBe(true)
  })

  it('ve un tipo que solo anula', () => {
    expect(canViewDocument('COT', ['document.void.COT'])).toBe(true)
  })

  it('no ve un tipo fuera de su rol', () => {
    expect(canViewDocument('CMO', ['document.create.CM', 'document.read'])).toBe(false)
  })

  it.each(['ar.read', 'ap.read', 'official.read'])('con %s ve cualquier tipo', (permission) => {
    expect(canViewDocument('DVV', [permission])).toBe(true)
  })
})
