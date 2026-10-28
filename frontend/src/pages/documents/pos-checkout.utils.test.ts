import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Document } from '@/types/document.types'

vi.mock('@/services/documents.service', () => ({
  getDocument: vi.fn(),
  getDocuments: vi.fn(),
}))

import { getDocument, getDocuments } from '@/services/documents.service'
import {
  arePaymentsValid,
  calculatePaymentDifference,
  findActivePendingPreventa,
  findPriceFloorViolations,
  getPendingQuantity,
  hasPendingItems,
  parseCreditLimitError,
  parseMissingStockError,
  type PaymentLine,
} from './pos-checkout.utils'

const apiError = (data: unknown) => ({ response: { data } })

describe('getPendingQuantity', () => {
  it('cantidad menos liberada menos convertida', () => {
    expect(getPendingQuantity({ quantity: 10, releasedQuantity: 3, convertedQuantity: 2 })).toBe(5)
  })

  it('liberada y convertida undefined cuentan como 0', () => {
    expect(
      getPendingQuantity({
        quantity: 10,
        releasedQuantity: undefined,
        convertedQuantity: undefined,
      }),
    ).toBe(10)
    expect(getPendingQuantity({ quantity: 10 } as never)).toBe(10)
  })

  it('totalmente consumida → 0', () => {
    expect(getPendingQuantity({ quantity: 4, releasedQuantity: 1, convertedQuantity: 3 })).toBe(0)
  })

  it('puede dar negativo si liberada + convertida pasan la cantidad (sin tope)', () => {
    expect(getPendingQuantity({ quantity: 4, releasedQuantity: 3, convertedQuantity: 3 })).toBe(-2)
  })
})

describe('hasPendingItems', () => {
  const item = (quantity: number, releasedQuantity = 0, convertedQuantity = 0) => ({
    quantity,
    releasedQuantity,
    convertedQuantity,
  })
  const doc = (...items: ReturnType<typeof item>[]) =>
    ({ documentItems: items }) as unknown as Pick<Document, 'documentItems'>

  it('sin líneas → false', () => {
    expect(hasPendingItems(doc())).toBe(false)
  })

  it('todas consumidas → false', () => {
    expect(hasPendingItems(doc(item(2, 2), item(5, 2, 3)))).toBe(false)
  })

  it('basta una línea con pendiente > 0 → true', () => {
    expect(hasPendingItems(doc(item(2, 2), item(5, 2, 2)))).toBe(true)
  })

  it('pendiente negativo no cuenta como pendiente', () => {
    expect(hasPendingItems(doc(item(1, 2, 2)))).toBe(false)
  })
})

describe('findActivePendingPreventa', () => {
  const detail = (id: string, quantity: number, converted = 0) =>
    ({
      id,
      documentItems: [{ quantity, releasedQuantity: 0, convertedQuantity: converted }],
    }) as unknown as Document

  beforeEach(() => {
    vi.mocked(getDocuments).mockReset()
    vi.mocked(getDocument).mockReset()
  })

  it('pide las PV confirmadas del cliente con límite 10', async () => {
    vi.mocked(getDocuments).mockResolvedValue({ items: [], meta: {} } as never)
    await findActivePendingPreventa('cust-1')
    expect(getDocuments).toHaveBeenCalledWith({
      type: 'PV',
      status: 'confirmed',
      thirdPartyId: 'cust-1',
      limit: 10,
    })
  })

  it('sin candidatas → null y no pide detalles', async () => {
    vi.mocked(getDocuments).mockResolvedValue({ items: [], meta: {} } as never)
    expect(await findActivePendingPreventa('cust-1')).toBeNull()
    expect(getDocument).not.toHaveBeenCalled()
  })

  it('devuelve la primera con pendiente, en el orden del listado', async () => {
    vi.mocked(getDocuments).mockResolvedValue({
      items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      meta: {},
    } as never)
    vi.mocked(getDocument).mockImplementation(async (id: string) =>
      id === 'a' ? detail('a', 2, 2) : detail(id, 2),
    )
    const found = await findActivePendingPreventa('cust-1')
    expect(found?.id).toBe('b')
    expect(getDocument).toHaveBeenCalledTimes(3)
  })

  it('ninguna con pendiente → null', async () => {
    vi.mocked(getDocuments).mockResolvedValue({ items: [{ id: 'a' }], meta: {} } as never)
    vi.mocked(getDocument).mockResolvedValue(detail('a', 2, 2))
    expect(await findActivePendingPreventa('cust-1')).toBeNull()
  })
})

describe('findPriceFloorViolations', () => {
  const floors = new Map([
    ['p1', 1000],
    ['p2', 500],
  ])

  it('sin líneas → vacío', () => {
    expect(findPriceFloorViolations([], floors)).toEqual([])
  })

  it('precio por debajo del piso es violación', () => {
    expect(
      findPriceFloorViolations([{ productId: 'p1', code: 'A-1', unitPrice: 999 }], floors),
    ).toEqual([{ code: 'A-1', unitPrice: 999, minSalePrice: 1000 }])
  })

  it('precio igual al piso no es violación (frontera)', () => {
    expect(
      findPriceFloorViolations([{ productId: 'p1', code: 'A-1', unitPrice: 1000 }], floors),
    ).toEqual([])
  })

  it('precio por encima del piso no es violación', () => {
    expect(
      findPriceFloorViolations([{ productId: 'p1', code: 'A-1', unitPrice: 1500 }], floors),
    ).toEqual([])
  })

  it('producto sin piso en el mapa se trata como piso 0 (nunca viola)', () => {
    expect(
      findPriceFloorViolations([{ productId: 'zzz', code: 'Z', unitPrice: 0 }], floors),
    ).toEqual([])
  })

  it('mantiene solo las líneas que violan y conserva el orden', () => {
    const result = findPriceFloorViolations(
      [
        { productId: 'p1', code: 'A-1', unitPrice: 900 },
        { productId: 'p2', code: 'B-2', unitPrice: 500 },
        { productId: 'p2', code: 'B-3', unitPrice: 100 },
      ],
      floors,
    )
    expect(result).toEqual([
      { code: 'A-1', unitPrice: 900, minSalePrice: 1000 },
      { code: 'B-3', unitPrice: 100, minSalePrice: 500 },
    ])
  })
})

describe('parseMissingStockError', () => {
  const missing = [{ productId: 'p1', code: 'A-1', requested: 5, available: 2 }]

  it('devuelve el arreglo missingStock de response.data', () => {
    expect(parseMissingStockError(apiError({ message: 'x', missingStock: missing }))).toEqual(
      missing,
    )
  })

  it('arreglo vacío también se devuelve (no es null)', () => {
    expect(parseMissingStockError(apiError({ missingStock: [] }))).toEqual([])
  })

  it('missingStock que no es arreglo → null', () => {
    expect(parseMissingStockError(apiError({ missingStock: 'x' }))).toBeNull()
    expect(parseMissingStockError(apiError({ missingStock: {} }))).toBeNull()
  })

  it('sin missingStock → null', () => {
    expect(parseMissingStockError(apiError({ message: 'x' }))).toBeNull()
  })

  it('data no objeto, null o ausente → null', () => {
    expect(parseMissingStockError(apiError('texto'))).toBeNull()
    expect(parseMissingStockError(apiError(null))).toBeNull()
    expect(parseMissingStockError({ response: {} })).toBeNull()
    expect(parseMissingStockError({})).toBeNull()
  })

  it('error que no es objeto → null', () => {
    expect(parseMissingStockError(null)).toBeNull()
    expect(parseMissingStockError(undefined)).toBeNull()
    expect(parseMissingStockError('boom')).toBeNull()
  })
})

describe('parseCreditLimitError', () => {
  const credit = { creditLimit: 1000, usedCredit: 800, availableCredit: 200 }

  it('devuelve el objeto credit si los tres montos son numéricos', () => {
    expect(parseCreditLimitError(apiError({ message: 'x', credit }))).toEqual(credit)
  })

  it('acepta montos en 0', () => {
    const zero = { creditLimit: 0, usedCredit: 0, availableCredit: 0 }
    expect(parseCreditLimitError(apiError({ credit: zero }))).toEqual(zero)
  })

  it('conserva campos extra de credit', () => {
    const withExtra = { ...credit, extra: 1 }
    expect(parseCreditLimitError(apiError({ credit: withExtra }))).toBe(withExtra)
  })

  it('un monto faltante o no numérico → null', () => {
    expect(
      parseCreditLimitError(apiError({ credit: { creditLimit: 1, usedCredit: 1 } })),
    ).toBeNull()
    expect(
      parseCreditLimitError(apiError({ credit: { ...credit, availableCredit: '200' } })),
    ).toBeNull()
  })

  it('credit ausente, null o no objeto → null', () => {
    expect(parseCreditLimitError(apiError({ message: 'x' }))).toBeNull()
    expect(parseCreditLimitError(apiError({ credit: null }))).toBeNull()
    expect(parseCreditLimitError(apiError({ credit: 5 }))).toBeNull()
  })

  it('data no objeto o error inválido → null', () => {
    expect(parseCreditLimitError(apiError(null))).toBeNull()
    expect(parseCreditLimitError(apiError('x'))).toBeNull()
    expect(parseCreditLimitError(null)).toBeNull()
    expect(parseCreditLimitError(new Error('boom'))).toBeNull()
  })
})

describe('calculatePaymentDifference', () => {
  const lines = (...amounts: (number | undefined)[]): PaymentLine[] =>
    amounts.map((amount) => ({ method: 'efectivo', amount }))

  it('sin líneas → todo el total falta', () => {
    expect(calculatePaymentDifference([], 5000)).toBe(5000)
  })

  it('sin líneas y total 0 → 0', () => {
    expect(calculatePaymentDifference([], 0)).toBe(0)
  })

  it('pago exacto → 0', () => {
    expect(calculatePaymentDifference(lines(3000, 2000), 5000)).toBe(0)
  })

  it('pago de menos → positivo (falta)', () => {
    expect(calculatePaymentDifference(lines(3000), 5000)).toBe(2000)
  })

  it('pago de más → negativo (sobra)', () => {
    expect(calculatePaymentDifference(lines(6000), 5000)).toBe(-1000)
  })

  it('monto undefined cuenta como 0', () => {
    expect(calculatePaymentDifference(lines(undefined, 1000), 5000)).toBe(4000)
  })

  it('no arrastra error de punto flotante (0.1 + 0.2)', () => {
    expect(calculatePaymentDifference(lines(0.1, 0.2), 0.3)).toBe(0)
  })

  it('redondea a centavos', () => {
    expect(calculatePaymentDifference(lines(10.004), 10)).toBe(0)
    expect(calculatePaymentDifference(lines(10.006), 10)).toBe(-0.01)
  })

  it('total con IVA 1.19 repartido en dos pagos cuadra', () => {
    expect(calculatePaymentDifference(lines(2521.01, 478.99), 3000)).toBe(0)
  })
})

describe('arePaymentsValid', () => {
  const line = (method: PaymentLine['method'], amount: number | undefined): PaymentLine => ({
    method,
    amount,
  })

  it('sin líneas es válido solo si el total es 0', () => {
    expect(arePaymentsValid([], 0)).toBe(true)
    expect(arePaymentsValid([], 100)).toBe(false)
  })

  it('una línea que cubre el total exacto es válida', () => {
    expect(arePaymentsValid([line('efectivo', 5000)], 5000)).toBe(true)
  })

  it('varias formas distintas que suman exacto son válidas', () => {
    expect(arePaymentsValid([line('efectivo', 3000), line('transferencia', 2000)], 5000)).toBe(true)
  })

  it('pago de menos es inválido', () => {
    expect(arePaymentsValid([line('efectivo', 4999.99)], 5000)).toBe(false)
  })

  it('pago de más es inválido', () => {
    expect(arePaymentsValid([line('efectivo', 5000.01)], 5000)).toBe(false)
  })

  it('forma de pago vacía es inválida', () => {
    expect(arePaymentsValid([line('', 5000)], 5000)).toBe(false)
  })

  it('monto 0, negativo o undefined es inválido', () => {
    expect(arePaymentsValid([line('efectivo', 0), line('tarjeta', 5000)], 5000)).toBe(false)
    expect(arePaymentsValid([line('efectivo', -1), line('tarjeta', 5001)], 5000)).toBe(false)
    expect(arePaymentsValid([line('efectivo', undefined), line('tarjeta', 5000)], 5000)).toBe(false)
  })

  it('forma de pago repetida es inválida aunque sume exacto', () => {
    expect(arePaymentsValid([line('efectivo', 3000), line('efectivo', 2000)], 5000)).toBe(false)
  })

  it('con líneas y total 0 es inválido (el monto debe ser > 0)', () => {
    expect(arePaymentsValid([line('efectivo', 0)], 0)).toBe(false)
  })

  it('suma con decimales que cuadra por centavos enteros es válida', () => {
    expect(arePaymentsValid([line('efectivo', 0.1), line('tarjeta', 0.2)], 0.3)).toBe(true)
  })
})
