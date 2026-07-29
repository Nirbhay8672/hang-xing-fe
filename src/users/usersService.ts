import { apiRequest } from '../auth/apiClient'
import type { CreateUserRequest, UpdateUserRequest, User } from './types'

export const usersService = {
  async list(): Promise<User[]> {
    const { data } = await apiRequest<{ data: User[] }>('/users')
    return data
  },

  async create(payload: CreateUserRequest): Promise<User> {
    const { data } = await apiRequest<{ data: User }>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return data
  },

  async update(id: number, payload: UpdateUserRequest): Promise<User> {
    const { data } = await apiRequest<{ data: User }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    return data
  },

  async remove(id: number): Promise<void> {
    await apiRequest<{ message: string }>(`/users/${id}`, { method: 'DELETE' })
  },
}
