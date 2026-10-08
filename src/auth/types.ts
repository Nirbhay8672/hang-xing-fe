export interface User {
  id: number
  name: string
  email: string
  roles: string[]
  permissions: string[]
  /** Hears about each newly booked order (bell + desktop alert) — set per person by an Admin. */
  notify_new_orders?: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface LoginResponse extends AuthTokens {
  user: User
}

export type RefreshResponse = AuthTokens

export interface ApiErrorBody {
  message?: string
  errors?: Record<string, string[]>
}
