import { apiRequest } from '../auth/apiClient'
import type { CreateSizeRequest, Size, UpdateSizeRequest } from './types'

export const sizesService = {
  async list(): Promise<Size[]> {
    return apiRequest<Size[]>('/sizes')
  },

  async get(id: number): Promise<Size> {
    return apiRequest<Size>(`/sizes/${id}`)
  },

  async create(payload: CreateSizeRequest): Promise<Size> {
    return apiRequest<Size>('/sizes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async update(id: number, payload: UpdateSizeRequest): Promise<Size> {
    return apiRequest<Size>(`/sizes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async remove(id: number): Promise<void> {
    await apiRequest<{ message: string }>(`/sizes/${id}`, { method: 'DELETE' })
  },
}
