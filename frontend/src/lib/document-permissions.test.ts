import { describe, expect, it } from 'vitest'
import {
  canChangeDocument,
  canViewDocument,
  canVoidDocument,
  visibleDocumentTypes,
} from './document-permissions'

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

describe('inventory_case.read', () => {
  const STOCK_MOVING = ['CM', 'COT', 'DVC', 'DVV', 'EAI', 'POS', 'SAJ', 'T']

  it('solo ve los tipos que mueven inventario', () => {
    expect(visibleDocumentTypes(['inventory_case.read']).sort()).toEqual(STOCK_MOVING)
    for (const type of ['CMO', 'POSO', 'PV'] as const) {
      expect(canViewDocument(type, ['inventory_case.read'])).toBe(false)
    }
  })

  it('suma los tipos propios del rol', () => {
    expect(visibleDocumentTypes(['inventory_case.read', 'document.convert.PV']).sort()).toEqual(
      [...STOCK_MOVING, 'PV'].sort(),
    )
  })
})

describe('visibleDocumentTypes', () => {
  it('lista solo los tipos que el rol crea, anula o convierte', () => {
    expect(
      visibleDocumentTypes(['document.create.T', 'document.void.POS', 'document.read']).sort(),
    ).toEqual(['POS', 'T'])
  })

  it.each(['ar.read', 'ap.read', 'official.read'])('con %s lista los 14 tipos', (permission) => {
    expect(visibleDocumentTypes([permission]).sort()).toEqual([
      'CM',
      'CMO',
      'COT',
      'DVC',
      'DVV',
      'EAI',
      'PE',
      'POS',
      'POSO',
      'PV',
      'REM',
      'RMDVC',
      'SAJ',
      'T',
    ])
  })
})

describe('canChangeDocument', () => {
  it('edita, elimina y confirma solo los tipos que crea', () => {
    expect(canChangeDocument('CMO', ['document.create.CMO'])).toBe(true)
  })

  it('no cambia un tipo que solo puede ver', () => {
    expect(canChangeDocument('CM', ['document.create.CMO', 'ap.read', 'document.read'])).toBe(false)
  })
})

describe('canVoidDocument', () => {
  it('anula una venta con document.void.{TIPO}', () => {
    expect(canVoidDocument('POS', ['document.void.POS'])).toBe(true)
  })

  it('crear una venta no alcanza para anularla', () => {
    expect(canVoidDocument('POS', ['document.create.POS'])).toBe(false)
  })

  it('anula un tipo que no es venta si lo crea', () => {
    expect(canVoidDocument('CMO', ['document.create.CMO'])).toBe(true)
  })

  it('no anula un tipo que no es venta si solo lo ve', () => {
    expect(canVoidDocument('CM', ['ap.read', 'document.void.POS', 'document.read'])).toBe(false)
  })
})
