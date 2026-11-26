// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PermissionGuard } from './PermissionGuard'
import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types'

function loginWith(permissions: string[]) {
  useAuthStore.setState({
    user: { permissions } as User,
    token: 'token',
    isAuthenticated: true,
  })
}

function renderGuard(permission: string | string[]) {
  render(
    <MemoryRouter>
      <PermissionGuard permission={permission}>
        <p>contenido protegido</p>
      </PermissionGuard>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('PermissionGuard', () => {
  it('sin el permiso muestra la página 403 y no renderiza los hijos', () => {
    loginWith(['product.read'])
    renderGuard('user.manage')
    expect(screen.getByText('403')).toBeTruthy()
    expect(screen.queryByText('contenido protegido')).toBeNull()
  })

  it('con el permiso renderiza los hijos', () => {
    loginWith(['user.manage'])
    renderGuard('user.manage')
    expect(screen.getByText('contenido protegido')).toBeTruthy()
    expect(screen.queryByText('403')).toBeNull()
  })

  it('con un arreglo de permisos basta con tener uno', () => {
    loginWith(['ap.read'])
    renderGuard(['ar.read', 'ap.read'])
    expect(screen.getByText('contenido protegido')).toBeTruthy()
  })
})
