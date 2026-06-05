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
  const token = res.data.data.access_token
  const payload = jwtDecode<JwtPayload>(token)

  const user: User = {
    id: payload.sub,
    name: payload.name,
    username: payload.username,
    permissions: payload.permissions,
  }

  return { token, user }
}
