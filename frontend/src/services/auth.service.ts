import { jwtDecode } from 'jwt-decode'
import { api } from './api'
import type { ApiResponse, JwtPayload, User } from '@/types'

interface LoginResponse {
  access_token: string
}

export interface LoginResult {
  token: string
  user: User
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', { username, password })
  return toLoginResult(res.data.data.access_token)
}

function toLoginResult(token: string): LoginResult {
  const payload = jwtDecode<JwtPayload>(token)

  const user: User = {
    id: payload.sub,
    name: payload.name,
    username: payload.username,
    permissions: payload.permissions,
    roles: payload.roles ?? [],
  }

  return { token, user }
}

// El backend invalida los tokens anteriores y devuelve uno nuevo para esta sesión
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<LoginResult> {
  const res = await api.patch<ApiResponse<LoginResponse>>('/auth/me/password', {
    currentPassword,
    newPassword,
  })
  return toLoginResult(res.data.data.access_token)
}
