import { apiRequest } from '../auth/apiClient'
import type { PermissionGroup } from './types'

export const permissionsService = {
  async list(): Promise<PermissionGroup[]> {
    const { data } = await apiRequest<{ data: PermissionGroup[] }>('/permissions')
    return data
  },
}
