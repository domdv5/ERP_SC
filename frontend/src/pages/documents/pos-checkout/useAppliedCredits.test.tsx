// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getAvailableCustomerCredits } from '@/services/documents.service'
import { useAppliedCredits } from './useAppliedCredits'

vi.mock('@/services/documents.service', () => ({ getAvailableCustomerCredits: vi.fn() }))

// Como los manda la API: los montos Decimal viajan como string
const apiCredits = {
  credits: [
    {
      id: 'c1',
      amount: '30.50',
      balance: '30.50',
      status: 'available',
      createdAt: '',
      sourceDocument: null,
    },
    {
      id: 'c2',
      amount: '20',
      balance: '20',
      status: 'available',
      createdAt: '',
      sourceDocument: null,
    },
  ],
  totalAvailable: 50.5,
}

function renderCredits(args: { total: number; grandTotal: number }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useAppliedCredits({ thirdPartyId: 'tp-1', official: false, ...args }), {
    wrapper,
  })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('useAppliedCredits', () => {
  it('expone los saldos como número aunque la API los mande como string', async () => {
    vi.mocked(getAvailableCustomerCredits).mockResolvedValue(apiCredits)
    const { result } = renderCredits({ total: 40, grandTotal: 40 })

    await waitFor(() => expect(result.current.availableCredits).toHaveLength(2))
    expect(result.current.availableCredits.map((c) => c.balance)).toEqual([30.5, 20])
  })

  it('propone solo saldos completos que caben, sin concatenar strings (30.5 + 20)', async () => {
    vi.mocked(getAvailableCustomerCredits).mockResolvedValue(apiCredits)
    const { result } = renderCredits({ total: 60, grandTotal: 60 })

    await waitFor(() => expect(result.current.selectedCredits).toHaveLength(2))
    expect(result.current.selectedCredits).toEqual([
      { customerCreditId: 'c1', amount: 30.5 },
      { customerCreditId: 'c2', amount: 20 },
    ])
    expect(result.current.creditsApplied).toBe(50.5)
    expect(result.current.totalToPay).toBe(9.5)
  })

  it('no propone un saldo mayor que lo que falta y lo deja sin poder marcar', async () => {
    vi.mocked(getAvailableCustomerCredits).mockResolvedValue(apiCredits)
    const { result } = renderCredits({ total: 25, grandTotal: 25 })

    await waitFor(() => expect(result.current.availableCredits).toHaveLength(2))
    expect(result.current.selectedCredits).toEqual([{ customerCreditId: 'c2', amount: 20 }])
    expect(result.current.canUseCredit('c1')).toBe(false)
  })

  it('al marcar un saldo se aplica completo, y al desmarcarlo se quita', async () => {
    vi.mocked(getAvailableCustomerCredits).mockResolvedValue(apiCredits)
    const { result } = renderCredits({ total: 100, grandTotal: 100 })
    await waitFor(() => expect(result.current.selectedCredits).toHaveLength(2))

    act(() => result.current.setCreditUsed('c1', false))
    expect(result.current.selectedCredits).toEqual([{ customerCreditId: 'c2', amount: 20 }])

    act(() => result.current.setCreditUsed('c1', true))
    expect(result.current.selectedCredits).toContainEqual({ customerCreditId: 'c1', amount: 30.5 })
  })

  it('suelta un saldo marcado a mano cuando el total baja y ya no cabe', async () => {
    vi.mocked(getAvailableCustomerCredits).mockResolvedValue(apiCredits)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result, rerender } = renderHook(
      ({ total }) =>
        useAppliedCredits({ thirdPartyId: 'tp-1', official: false, total, grandTotal: total }),
      { wrapper, initialProps: { total: 100 } },
    )
    await waitFor(() => expect(result.current.selectedCredits).toHaveLength(2))
    act(() => result.current.setCreditUsed('c1', true))

    rerender({ total: 25 })
    await waitFor(() =>
      expect(result.current.selectedCredits).toEqual([{ customerCreditId: 'c2', amount: 20 }]),
    )
  })
})
