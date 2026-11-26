// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { getCustomerPaymentOpenItems } from '@/services/customer-payments.service'
import { useCustomerPaymentForm } from './useCustomerPaymentForm'

vi.mock('@/services/customer-payments.service', () => ({
  getCustomerPaymentOpenItems: vi.fn(),
  createCustomerPayment: vi.fn(),
}))
vi.mock('@/hooks/useCustomerBranches', () => ({
  useCustomerBranches: () => ({ branches: [], isLoading: false }),
}))

const openItems = {
  receivables: [{ id: 'r1', balance: '500000', document: { customerBranch: null } }],
  credits: [
    { id: 'c1', balance: '200000', usableIn: 'administracion' },
    { id: 'c2', balance: '800000', usableIn: 'administracion' },
  ],
}

async function renderForm() {
  vi.mocked(getCustomerPaymentOpenItems).mockResolvedValue(openItems as never)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  const hook = renderHook(() => useCustomerPaymentForm(), { wrapper })
  act(() => hook.result.current.setValue('clientId', 'cli-1'))
  await waitFor(() => expect(hook.result.current.watch('credits')).toHaveLength(2))
  act(() => hook.result.current.toggleReceivable('r1', true))
  return hook
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('useCustomerPaymentForm — saldos a favor', () => {
  it('al marcar un saldo se aplica completo y al desmarcar vuelve a 0', async () => {
    const { result } = await renderForm()
    act(() => result.current.toggleCredit(0, true))
    expect(result.current.watch('credits')[0].amount).toBe(200000)

    act(() => result.current.toggleCredit(0, false))
    expect(result.current.watch('credits')[0].amount).toBe(0)
  })

  it('no deja usar un saldo mayor que lo pendiente tras el descuento', async () => {
    const { result } = await renderForm()
    expect(result.current.canUseCreditAt(0)).toBe(true)
    expect(result.current.canUseCreditAt(1)).toBe(false)

    act(() => {
      result.current.toggleDiscount(true)
      result.current.setValue('discountAmount', 400000)
    })
    // pendiente 500000 − 400000 = 100000: el de 200000 ya no cabe
    expect(result.current.canUseCreditAt(0)).toBe(false)
  })

  it('el saldo marcado sigue marcado si bajan los abonos: bloquea el guardado y se recupera al subirlos', async () => {
    const { result } = await renderForm()
    act(() => result.current.toggleCredit(0, true))
    act(() => result.current.setReceivableAmount('r1', 100000))

    expect(result.current.watch('credits')[0].amount).toBe(200000)
    expect(result.current.creditOverflowIndex).toBe(0)
    expect(result.current.cuadraOk).toBe(false)

    act(() => result.current.setReceivableAmount('r1', 500000))
    expect(result.current.watch('credits')[0].amount).toBe(200000)
    expect(result.current.creditOverflowIndex).toBe(-1)
  })
})
