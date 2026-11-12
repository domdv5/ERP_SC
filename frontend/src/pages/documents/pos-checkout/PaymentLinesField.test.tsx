// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PaymentLinesField } from './PaymentLinesField'
import type { PaymentLine } from '@/pages/documents/pos-checkout.utils'

afterEach(cleanup)

function renderField(
  props: Partial<Parameters<typeof PaymentLinesField>[0]> = {},
  lines: PaymentLine[] = [{ method: '', amount: 500000 }],
) {
  return render(
    <PaymentLinesField
      paymentLines={lines}
      paymentDifference={0}
      totalToPay={500000}
      official={false}
      hasCustomer
      availableCredit={1200000}
      isLoadingCredit={false}
      onMethodChange={vi.fn()}
      onAmountChange={vi.fn()}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
      {...props}
    />,
  )
}

const hasCreditOption = () => screen.queryByRole('option', { name: 'Crédito' }) !== null

describe('PaymentLinesField — Crédito', () => {
  it('ofrece Crédito en POS normal con cliente', () => {
    renderField()
    expect(hasCreditOption()).toBe(true)
  })

  it('no ofrece Crédito en M2 (oficial)', () => {
    renderField({ official: true })
    expect(hasCreditOption()).toBe(false)
  })

  it('no ofrece Crédito sin cliente', () => {
    renderField({ hasCustomer: false })
    expect(hasCreditOption()).toBe(false)
  })

  it('muestra el cupo solo cuando hay línea de crédito', () => {
    renderField({}, [
      { method: 'efectivo_almacen', amount: 300000 },
      { method: 'credito', amount: 200000 },
    ])
    expect(screen.getByText(/Cupo disponible: \$\s?1\.200\.000/)).toBeTruthy()
  })

  it('no muestra cupo sin línea de crédito', () => {
    renderField({}, [{ method: 'efectivo_almacen', amount: 500000 }])
    expect(screen.queryByText(/Cupo disponible/)).toBeNull()
  })

  it('avisa si el crédito cubre toda la venta', () => {
    renderField({}, [{ method: 'credito', amount: 500000 }])
    expect(screen.getByText(/haz una venta a crédito \(COT\)/)).toBeTruthy()
  })

  it('avisa si el crédito supera el cupo', () => {
    renderField({ availableCredit: 100000 }, [
      { method: 'efectivo_almacen', amount: 300000 },
      { method: 'credito', amount: 200000 },
    ])
    expect(screen.getByText(/supera el cupo disponible/)).toBeTruthy()
  })
})
