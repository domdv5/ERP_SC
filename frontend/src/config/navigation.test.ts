import { describe, expect, it } from 'vitest'
import { findHomePath } from './navigation'

describe('findHomePath', () => {
  it('con report.read entra a Informes', () => {
    expect(findHomePath(['report.read'])).toBe('/reports')
  })

  it('solo con document.read entra a Operaciones', () => {
    expect(findHomePath(['document.read', 'thirdparty.read'])).toBe('/documents')
  })

  it('con report.read y document.read gana Informes', () => {
    expect(findHomePath(['document.read', 'report.read'])).toBe('/reports')
  })

  it('sin ninguno de los dos entra a Productos, que no pide permiso', () => {
    expect(findHomePath([])).toBe('/products')
    expect(findHomePath(['thirdparty.read'])).toBe('/products')
  })
})
