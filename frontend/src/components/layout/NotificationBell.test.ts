import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types'
import { NotificationBell, NotificationBellView, buildPendingItems } from './NotificationBell'

vi.mock('@/services/inventory-cases.service', () => ({
  getInventoryCaseOpenCount: vi.fn(),
}))

const OPEN_COUNT_KEY = ['inventory-cases', 'open-count']

function renderView(openInventoryCases: number, defaultOpen = true) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(NotificationBellView, {
        items: buildPendingItems({ openInventoryCases }),
        defaultOpen,
      }),
    ),
  )
}

// Hay dato en caché para probar que sin permiso el hook ni se monta.
function renderBell(permissions: string[], cachedCount: number) {
  useAuthStore.setState({ user: { permissions } as unknown as User })
  const queryClient = new QueryClient()
  queryClient.setQueryData(OPEN_COUNT_KEY, { count: cachedCount })
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, null, createElement(NotificationBell)),
    ),
  )
}

describe('buildPendingItems', () => {
  it('sin casos abiertos no arma ítems', () => {
    expect(buildPendingItems({ openInventoryCases: 0 })).toEqual([])
  })

  it('usa singular con 1 caso', () => {
    expect(buildPendingItems({ openInventoryCases: 1 })[0]?.label).toBe(
      '1 caso de inventario abierto',
    )
  })

  it('usa plural y enlaza a la bandeja', () => {
    expect(buildPendingItems({ openInventoryCases: 3 })).toEqual([
      {
        id: 'inventory-cases',
        label: '3 casos de inventario abiertos',
        count: 3,
        to: '/inventory-cases',
      },
    ])
  })
})

describe('NotificationBellView', () => {
  it('con 0 pendientes no muestra punto y dice que no hay pendientes', () => {
    const html = renderView(0)
    expect(html).not.toContain('bell-dot')
    expect(html).toContain('No tienes pendientes')
  })

  it('con 3 pendientes muestra el punto con el número y el enlace', () => {
    const html = renderView(3)
    expect(html).toContain('bell-dot')
    expect(html).toContain('3 casos de inventario abiertos')
    expect(html).toContain('href="/inventory-cases"')
  })

  it('cerrado marca aria-expanded en falso y no lista ítems', () => {
    const html = renderView(3, false)
    expect(html).toContain('aria-label="Pendientes"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('casos de inventario abiertos')
  })
})

describe('NotificationBell', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('con permiso lee el contador y prende el punto', () => {
    expect(renderBell(['inventory_case.read'], 3)).toContain('bell-dot')
  })

  it('sin permiso no usa el contador aunque esté en caché', () => {
    expect(renderBell(['document.read'], 3)).not.toContain('bell-dot')
  })
})
