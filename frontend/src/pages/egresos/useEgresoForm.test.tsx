// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { getEgresoOpenItems } from '@/services/egresos.service'
import { useEgresoForm } from './useEgresoForm'

vi.mock('@/services/egresos.service', () => ({
  getEgresoOpenItems: vi.fn(),
  createEgreso: vi.fn(),
}))

const openItems = {
  payables: [{ id: 'p1', balance: '500000' }],
  credits: [{ id: 'c1', balance: '200000' }],
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('useEgresoForm', () => {
  it('el saldo a favor arranca en 0 y solo se llena con "Usar todo"', async () => {
    vi.mocked(getEgresoOpenItems).mockResolvedValue(openItems as never)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    )
    const { result } = renderHook(() => useEgresoForm(), { wrapper })

    act(() => result.current.setValue('supplierId', 'sup-1'))
    await waitFor(() => expect(result.current.watch('payables')).toHaveLength(1))
    act(() => result.current.togglePayable('p1', true))

    expect(result.current.watch('credits')[0].amount).toBe(0)

    act(() => result.current.fillCredit(0))
    expect(result.current.watch('credits')[0].amount).toBe(200000)
  })
})
