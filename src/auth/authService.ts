import { apiRequest } from './apiClient'
import { tokenStorage } from './tokenStorage'
import type { LoginRequest, LoginResponse, User } from './types'

export const authService = {
  async login(credentials: LoginRequest): Promise<User> {
    const data = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(credentials),
    })
    tokenStorage.setTokens(data)
    return data.user
  },

  async logout(): Promise<void> {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' })
    } finally {
      // Always drop local tokens, even if the network call failed — an unreachable
      // API shouldn't be able to trap the user in a "logged in" client state.
      tokenStorage.clear()
    }
  },

  async fetchMe(): Promise<User> {
    return apiRequest<User>('/me')
  },
}
