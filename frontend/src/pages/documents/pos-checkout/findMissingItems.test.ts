import { describe, expect, it } from 'vitest'
import type { PaymentLine } from '@/pages/documents/pos-checkout.utils'
import { findMissingItems } from './findMissingItems'

type Input = Parameters<typeof findMissingItems>[0]

const cashLine: PaymentLine = { method: 'efectivo_almacen', amount: 100 }

const completeSale: Input = {
  thirdPartyId: 'tp-1',
  isLoadingBranches: false,
  needsBranch: true,
  customerBranchId: 'branch-1',
  sellerId: 'seller-1',
  needsPayments: true,
  paymentLines: [cashLine],
  totalToPay: 100,
  hasValidItems: true,
  hasPriceFloorViolations: false,
  isCredit: false,
  isLoadingCredit: false,
  creditExceeded: false,
}

describe('findMissingItems', () => {
  it('devuelve lista vacía cuando la venta está completa', () => {
    expect(findMissingItems(completeSale)).toEqual([])
  })

  it('pide cliente cuando no hay tercero', () => {
    expect(findMissingItems({ ...completeSale, thirdPartyId: '' })).toEqual([
      'Selecciona un cliente',
    ])
  })

  it('avisa cuando la venta supera el cupo de crédito', () => {
    expect(findMissingItems({ ...completeSale, isCredit: true, creditExceeded: true })).toEqual([
      'La venta supera el cupo de crédito disponible del cliente',
    ])
  })

  it('no pide formas de pago cuando no se necesitan', () => {
    expect(
      findMissingItems({ ...completeSale, needsPayments: false, paymentLines: [], totalToPay: 0 }),
    ).toEqual([])
  })

  it('mantiene el orden de los mensajes cuando faltan varias cosas', () => {
    const everythingMissing: Input = {
      thirdPartyId: 'tp-1',
      isLoadingBranches: true,
      needsBranch: true,
      customerBranchId: '',
      sellerId: '',
      needsPayments: true,
      paymentLines: [{ method: '', amount: undefined }],
      totalToPay: 100,
      hasValidItems: false,
      hasPriceFloorViolations: true,
      isCredit: true,
      isLoadingCredit: true,
      creditExceeded: true,
    }

    expect(findMissingItems(everythingMissing)).toEqual([
      'Cargando sucursales del cliente...',
      'Selecciona la sucursal del cliente',
      'Selecciona una vendedora',
      'Selecciona una forma de pago',
      'Las formas de pago deben sumar el total a cobrar',
      'Agrega al menos un producto con cantidad válida',
      'Corrige los precios por debajo del mínimo permitido',
      'Cargando cupo de crédito del cliente...',
      'La venta supera el cupo de crédito disponible del cliente',
    ])
    expect(findMissingItems({ ...everythingMissing, thirdPartyId: '' })[0]).toBe(
      'Selecciona un cliente',
    )
  })
})
