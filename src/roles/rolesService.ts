import { apiRequest } from '../auth/apiClient'
import type { CreateRoleRequest, Role, UpdateRoleRequest } from './types'

export const rolesService = {
  async list(): Promise<Role[]> {
    const { data } = await apiRequest<{ data: Role[] }>('/roles')
    return data
  },

  async create(payload: CreateRoleRequest): Promise<Role> {
    const { data } = await apiRequest<{ data: Role }>('/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return data
  },

  async update(id: number, payload: UpdateRoleRequest): Promise<Role> {
    const { data } = await apiRequest<{ data: Role }>(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    return data
  },

  async remove(id: number): Promise<void> {
    await apiRequest<{ message: string }>(`/roles/${id}`, { method: 'DELETE' })
  },
}
