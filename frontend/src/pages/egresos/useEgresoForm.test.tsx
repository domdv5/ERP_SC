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
  credits: [
    { id: 'c1', balance: '200000' },
    { id: 'c2', balance: '800000' },
  ],
}

async function renderForm() {
  vi.mocked(getEgresoOpenItems).mockResolvedValue(openItems as never)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  const hook = renderHook(() => useEgresoForm(), { wrapper })
  act(() => hook.result.current.setValue('supplierId', 'sup-1'))
  await waitFor(() => expect(hook.result.current.watch('credits')).toHaveLength(2))
  act(() => hook.result.current.togglePayable('p1', true))
  return hook
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('useEgresoForm', () => {
  it('el saldo a favor arranca sin usar y al marcarlo se aplica completo', async () => {
    const { result } = await renderForm()
    expect(result.current.watch('credits')[0].amount).toBe(0)

    act(() => result.current.toggleCredit(0, true))
    expect(result.current.watch('credits')[0].amount).toBe(200000)

    act(() => result.current.toggleCredit(0, false))
    expect(result.current.watch('credits')[0].amount).toBe(0)
  })

  it('no deja usar un saldo mayor que lo pendiente de los abonos', async () => {
    const { result } = await renderForm()
    expect(result.current.canUseCreditAt(0)).toBe(true)
    expect(result.current.canUseCreditAt(1)).toBe(false)
  })

  it('un saldo marcado reduce lo pendiente para los demás', async () => {
    const { result } = await renderForm()
    act(() => result.current.toggleCredit(0, true))
    // pendiente 500000 − 200000 = 300000: el de 800000 sigue sin caber
    expect(result.current.canUseCreditAt(1)).toBe(false)
  })

  it('suelta el saldo marcado cuando bajan los abonos y ya no cabe', async () => {
    const { result } = await renderForm()
    act(() => result.current.toggleCredit(0, true))
    act(() => result.current.setPayableAmount('p1', 100000))

    await waitFor(() => expect(result.current.watch('credits')[0].amount).toBe(0))
  })
})
