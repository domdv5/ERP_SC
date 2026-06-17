import { api } from './api'
import type { ApiResponse } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserRole {
  id: string
  name: string
  description: string | null
}

export interface AppUser {
  id: string
  name: string
  username: string
  active: boolean
  createdAt: string
  userRoles: { role: UserRole }[]
}

export interface Role {
  id: string
  name: string
  description: string | null
  rolePermissions: { permission: { id: string; code: string; module: string } }[]
}

export interface CreateUserPayload {
  name: string
  username: string
  password: string
  roleIds: string[]
  active?: boolean
}

export interface UpdateUserPayload {
  name?: string
  username?: string
  password?: string
  roleIds?: string[]
  active?: boolean
}

// ---------------------------------------------------------------------------
// Role display names
// ---------------------------------------------------------------------------

export const ROLE_LABELS: Record<string, string> = {
  admin:                       'Administrador',
  purchasing:                  'Compras',
  warehouse:                   'Bodega',
  basket_management:           'Gestión de Canasta',
  billing:                     'Facturación',
  accounts_payable_admin:      'Admin. Cuentas por Pagar',
  accounts_receivable_admin:   'Admin. Cuentas por Cobrar',
}

export function getRoleLabel(name: string): string {
  return ROLE_LABELS[name] ?? name.replace(/_/g, ' ')
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function getUsers(): Promise<AppUser[]> {
  const res = await api.get<ApiResponse<AppUser[]>>('/auth')
  return res.data.data
}

export async function getRoles(): Promise<Role[]> {
  const res = await api.get<ApiResponse<Role[]>>('/auth/roles')
  return res.data.data
}

export async function createUser(payload: CreateUserPayload): Promise<AppUser> {
  const res = await api.post<ApiResponse<AppUser>>('/auth', payload)
  return res.data.data
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<AppUser> {
  const res = await api.patch<ApiResponse<AppUser>>(`/auth/${id}`, payload)
  return res.data.data
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/auth/${id}`)
}
