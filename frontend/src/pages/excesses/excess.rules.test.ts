import { describe, expect, it } from 'vitest'
import {
  buildCreateExcessBody,
  canConfirmVoid,
  findExcessFormError,
  NO_BRANCH,
} from './excess.rules'

const valid = {
  thirdPartyId: 'tp1',
  hasBranches: true,
  branchId: 'b1',
  amount: 1000,
  date: '2026-11-27',
  today: '2026-11-27',
}

describe('findExcessFormError', () => {
  it('acepta un formulario completo', () => {
    expect(findExcessFormError(valid)).toBeNull()
  })

  it('exige elegir sucursal cuando el cliente tiene sucursales', () => {
    expect(findExcessFormError({ ...valid, branchId: '' })).toBe('Selecciona una sucursal')
  })

  it('"Sin sucursal" cuenta como elección válida', () => {
    expect(findExcessFormError({ ...valid, branchId: NO_BRANCH })).toBeNull()
  })

  it('no exige sucursal si el tercero no tiene sucursales', () => {
    expect(findExcessFormError({ ...valid, hasBranches: false, branchId: '' })).toBeNull()
  })

  it('rechaza valor cero y fecha futura', () => {
    expect(findExcessFormError({ ...valid, amount: 0 })).not.toBeNull()
    expect(findExcessFormError({ ...valid, date: '2026-11-28' })).not.toBeNull()
  })
})

describe('buildCreateExcessBody', () => {
  it('"Sin sucursal" no manda customerBranchId', () => {
    expect(
      buildCreateExcessBody('customer', { ...valid, branchId: NO_BRANCH }).customerBranchId,
    ).toBeUndefined()
  })

  it('un proveedor nunca manda sucursal', () => {
    expect(buildCreateExcessBody('supplier', valid).customerBranchId).toBeUndefined()
  })

  it('un cliente con sucursal manda su id', () => {
    expect(buildCreateExcessBody('customer', valid).customerBranchId).toBe('b1')
  })
})

describe('canConfirmVoid', () => {
  it('sin motivo no confirma', () => {
    expect(canConfirmVoid('', '')).toBe(false)
  })

  it('"Otro" exige texto no vacío', () => {
    expect(canConfirmVoid('otro', '   ')).toBe(false)
    expect(canConfirmVoid('otro', 'duplicado')).toBe(true)
  })

  it('los demás motivos no piden texto', () => {
    expect(canConfirmVoid('valor_mal_digitado', '')).toBe(true)
  })
})
