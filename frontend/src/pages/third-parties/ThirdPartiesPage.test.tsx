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

  it('muestra Cupo, Usado y Disponible sin filtro cuando las filas traen credit', async () => {
    renderPage()
    await screen.findByText('Ana SAS')
    expect(screen.getByText('Cupo')).toBeTruthy()
    expect(screen.getByText('Usado')).toBeTruthy()
    expect(screen.getByText('Disponible')).toBeTruthy()
    expect(screen.getByText(/1\.000\.000/).className).not.toContain('font-bold')
    expect(screen.getByText(/400\.000/)).toBeTruthy()
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

  it('se oculta si ninguna fila trae credit', async () => {
    mockItems([makeItem('Ana SAS')])
    renderPage()
    await screen.findByText('Ana SAS')
    expect(screen.queryByText('Cupo')).toBeNull()
  })

  it('Disponible > 0 va en verde y negrita', async () => {
    renderPage()
    await screen.findByText('Ana SAS')
    const available = screen.getByText(/600\.000/)
    expect(available.className).toContain('text-brand-secondary')
    expect(available.className).toContain('font-bold')
    expect(available.className).not.toContain('text-red-600')
  })

  it('Disponible <= 0 va en rojo', async () => {
    mockItems([
      makeItem('Ana SAS', { creditLimit: 500000, usedCredit: 500000, availableCredit: 0 }),
    ])
    renderPage()
    await screen.findByText('Ana SAS')
    const available = screen.getByText(/^\$\s?0$/)
    expect(available.className).toContain('text-red-600')
    expect(available.className).toContain('font-bold')
  })

  it('cupo 0 muestra — en Cupo, el Usado y el Disponible negativo en rojo', async () => {
    mockItems([makeItem('Ana SAS', { creditLimit: 0, usedCredit: 50000, availableCredit: -50000 })])
    renderPage()
    await screen.findByText('Ana SAS')
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText(/^\$\s?50\.000$/)).toBeTruthy()
    expect(screen.getByText(/-\s?\$\s?50\.000|\$\s?-50\.000/).className).toContain('text-red-600')
  })

  it('una fila sin credit deja las tres celdas vacías', async () => {
    mockItems([
      makeItem('Ana SAS', { creditLimit: 1000000, usedCredit: 400000, availableCredit: 600000 }),
      makeItem('Beto SAS'),
    ])
    renderPage()
    const row = (await screen.findByText('Beto SAS')).closest('tr') as HTMLElement
    const cells = Array.from(row.querySelectorAll('td'))
    expect(cells).toHaveLength(9)
    expect(cells.slice(5, 8).every((td) => td.textContent === '')).toBe(true)
  })

  it('no muestra el texto "usado $X de $Y"', async () => {
    renderPage()
    await screen.findByText('Ana SAS')
    expect(screen.queryByText(/usado .* de /)).toBeNull()
    expect(screen.queryByText(/Sin cupo/)).toBeNull()
  })
})
