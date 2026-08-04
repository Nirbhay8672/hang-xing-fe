import { apiRequest } from '../auth/apiClient'
import type { Profile, UpdateProfileRequest } from './types'

export const profileService = {
  async show(): Promise<Profile> {
    const { data } = await apiRequest<{ data: Profile }>('/profile')
    return data
  },

  async update(payload: UpdateProfileRequest): Promise<Profile> {
    const { data } = await apiRequest<{ data: Profile }>('/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    return data
  },
}
