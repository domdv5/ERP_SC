import { describe, expect, it } from 'vitest'
import { DOCUMENT_VOID_REASONS_BY_TYPE } from '@/types'
import { buildVoidPayload, getVoidReasonsForType } from './void-document.utils'

describe('motivos de anulación por tipo (espejo del backend)', () => {
  it('CM y DVC excluyen cliente_equivocado', () => {
    expect(DOCUMENT_VOID_REASONS_BY_TYPE.CM).toHaveLength(8)
    expect(DOCUMENT_VOID_REASONS_BY_TYPE.CM).not.toContain('cliente_equivocado')
    expect(DOCUMENT_VOID_REASONS_BY_TYPE.DVC).toEqual(DOCUMENT_VOID_REASONS_BY_TYPE.CM)
  })

  it('CMO excluye cliente_equivocado y bodega_equivocada', () => {
    expect(DOCUMENT_VOID_REASONS_BY_TYPE.CMO).toHaveLength(7)
    expect(DOCUMENT_VOID_REASONS_BY_TYPE.CMO).not.toContain('cliente_equivocado')
    expect(DOCUMENT_VOID_REASONS_BY_TYPE.CMO).not.toContain('bodega_equivocada')
  })

  it('DVV excluye proveedor_equivocado', () => {
    expect(DOCUMENT_VOID_REASONS_BY_TYPE.DVV).toHaveLength(8)
    expect(DOCUMENT_VOID_REASONS_BY_TYPE.DVV).not.toContain('proveedor_equivocado')
  })

  it('EAI acepta solo su lista; sin operacion_no_realizada', () => {
    expect(DOCUMENT_VOID_REASONS_BY_TYPE.EAI).toEqual([
      'cantidad_equivocada',
      'producto_equivocado',
      'costo_equivocado',
      'bodega_equivocada',
      'documento_duplicado',
      'otro',
    ])
  })

  it('ventas, traslados, preventas y SAJ no piden motivo', () => {
    for (const type of ['POS', 'COT', 'POSO', 'REM', 'T', 'PV', 'SAJ'] as const) {
      expect(getVoidReasonsForType(type)).toBeNull()
    }
  })
})

describe('buildVoidPayload', () => {
  it('sin motivo no se puede confirmar', () => {
    expect(buildVoidPayload('', '')).toBeNull()
  })

  it('"Otro" con texto en blanco no se puede confirmar', () => {
    expect(buildVoidPayload('otro', '   ')).toBeNull()
  })

  it('"Otro" con texto envía el texto recortado', () => {
    expect(buildVoidPayload('otro', ' algo ')).toEqual({ reason: 'otro', reasonOther: 'algo' })
  })

  it('un motivo válido no envía texto libre', () => {
    expect(buildVoidPayload('documento_duplicado', 'ignorado')).toEqual({
      reason: 'documento_duplicado',
    })
  })
})
