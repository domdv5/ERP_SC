// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  it('no ofrece Crédito en M2 (oficial)', () => {
    renderField({ official: true })
    expect(hasCreditOption()).toBe(false)
  })

  it('no ofrece Crédito sin cliente', () => {
    renderField({ hasCustomer: false })
    expect(hasCreditOption()).toBe(false)
  })

  const creditLines: PaymentLine[] = [
    { method: 'efectivo_almacen', amount: 300000 },
    { method: 'credito', amount: 200000 },
  ]

  it('si falla la consulta del cupo avisa y ofrece reintentar', () => {
    const onRetryCredit = vi.fn()
    renderField(
      { availableCredit: undefined, isCreditQueryError: true, onRetryCredit },
      creditLines,
    )
    expect(screen.getByText(/No se pudo consultar el cupo\./)).toBeTruthy()
    expect(screen.queryByText(/Consultando cupo/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetryCredit).toHaveBeenCalledTimes(1)
  })
})
