import { apiRequest } from '../auth/apiClient'
import type { Role } from './types'

export const rolesService = {
  async list(): Promise<Role[]> {
    const { data } = await apiRequest<{ data: Role[] }>('/roles')
    return data
  },
}
