// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

async function selectCustomerFilter() {
  fireEvent.change(await screen.findByDisplayValue('Todos los roles'), {
    target: { value: 'customer' },
  })
}

describe('ThirdPartiesPage columna Cupo', () => {
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

  it('se muestra con filtro Clientes y permiso, con disponible y usado/total', async () => {
    renderPage()
    await selectCustomerFilter()
    expect(await screen.findByText('Cupo')).toBeTruthy()
    expect(await screen.findByText(/usado .*400\.000.* de .*1\.000\.000/)).toBeTruthy()
    expect(screen.getByText(/600\.000/).className).not.toContain('text-red-600')
  })

  it('también se muestra con customer.credit.update', async () => {
    grantedPermissions = ['customer.credit.update']
    renderPage()
    await selectCustomerFilter()
    expect(await screen.findByText('Cupo')).toBeTruthy()
  })

  it('se oculta con otro filtro', async () => {
    renderPage()
    await screen.findByText('Ana SAS')
    expect(screen.queryByText('Cupo')).toBeNull()
  })

  it('se oculta sin permiso', async () => {
    grantedPermissions = []
    renderPage()
    await selectCustomerFilter()
    await screen.findByText('Ana SAS')
    expect(screen.queryByText('Cupo')).toBeNull()
  })

  it('disponible <= 0 se pinta en rojo', async () => {
    mockItems([
      makeItem('Ana SAS', { creditLimit: 500000, usedCredit: 500000, availableCredit: 0 }),
    ])
    renderPage()
    await selectCustomerFilter()
    const available = await screen.findByText(/^\$\s?0$/)
    expect(available.className).toContain('text-red-600')
  })

  it('muestra — si el cupo es 0 o no viene credit', async () => {
    mockItems([
      makeItem('Ana SAS', { creditLimit: 0, usedCredit: 0, availableCredit: 0 }),
      makeItem('Beto SAS'),
    ])
    renderPage()
    await selectCustomerFilter()
    await screen.findByText('Cupo')
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
