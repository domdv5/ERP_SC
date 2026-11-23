// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ThirdPartyListResponse } from '@contracts/third-parties'
import ThirdPartiesPage from './ThirdPartiesPage'
import { getThirdParties } from '@/services/third-parties.service'

vi.mock('@/services/third-parties.service', () => ({
  getThirdParties: vi.fn(),
  createThirdParty: vi.fn(),
  updateThirdParty: vi.fn(),
  deleteThirdParty: vi.fn(),
  reactivateThirdParty: vi.fn(),
  renameBrand: vi.fn(),
  updateCustomerBranch: vi.fn(),
}))

let grantedPermissions: string[] = []
vi.mock('@/hooks/usePermission', () => ({
  usePermission: (p: string) => grantedPermissions.includes(p),
}))
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: (selector: (s: { user: { permissions: string[] } }) => unknown) =>
    selector({ user: { permissions: grantedPermissions } }),
}))
vi.mock('./components/ThirdPartyForm', () => ({ ThirdPartyForm: () => null }))
vi.mock('./components/DeleteConfirmDialog', () => ({ DeleteConfirmDialog: () => null }))

function makeItem(
  name: string,
  credit?: { creditLimit: number; usedCredit: number; availableCredit: number },
) {
  return {
    id: name,
    name,
    personType: 'juridica',
    documentType: 'NIT',
    documentNumber: '900',
    isCustomer: true,
    credit,
  }
}

function mockItems(items: unknown[]) {
  const response = {
    items,
    meta: {
      total: items.length,
      page: 1,
      limit: 10,
      totalPages: 1,
      customerCount: 1,
      supplierCount: 0,
    },
  } as unknown as ThirdPartyListResponse
  vi.mocked(getThirdParties).mockResolvedValue(response)
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ThirdPartiesPage />
    </QueryClientProvider>,
  )
}

describe('ThirdPartiesPage columnas de crédito', () => {
  beforeEach(() => {
    grantedPermissions = ['document.create.COT']
    mockItems([
      makeItem('Ana SAS', { creditLimit: 1000000, usedCredit: 400000, availableCredit: 600000 }),
    ])
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('se muestra sin filtro con document.create.COT', async () => {
    renderPage()
    expect(await screen.findByText('Cupo')).toBeTruthy()
  })

  it('también se muestra con customer.credit.update', async () => {
    grantedPermissions = ['customer.credit.update']
    renderPage()
    expect(await screen.findByText('Cupo')).toBeTruthy()
  })

  it('se oculta sin permiso', async () => {
    grantedPermissions = []
    renderPage()
    await screen.findByText('Ana SAS')
    expect(screen.queryByText('Cupo')).toBeNull()
    expect(screen.queryByText('Disponible')).toBeNull()
  })
})
