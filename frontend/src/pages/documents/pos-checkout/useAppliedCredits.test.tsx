// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
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

  it('propone montos numéricos que suman bien (30.5 + 9.5, sin concatenar strings)', async () => {
    vi.mocked(getAvailableCustomerCredits).mockResolvedValue(apiCredits)
    const { result } = renderCredits({ total: 40, grandTotal: 40 })

    await waitFor(() => expect(result.current.selectedCredits).toHaveLength(2))
    expect(result.current.selectedCredits).toEqual([
      { customerCreditId: 'c1', amount: 30.5 },
      { customerCreditId: 'c2', amount: 9.5 },
    ])
    expect(result.current.creditsApplied).toBe(40)
    expect(result.current.totalToPay).toBe(0)
  })
})
