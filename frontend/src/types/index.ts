export type { ThirdParty, CreateThirdPartyPayload, UpdateThirdPartyPayload, PersonType, DocumentType } from './third-party.types'

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface JwtPayload {
  sub: number
  name: string
  username: string
  permissions: string[]
}

export interface User {
  id: number
  name: string
  username: string
  permissions: string[]
}
