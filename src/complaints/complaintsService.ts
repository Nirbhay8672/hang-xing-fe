import { apiRequest } from '../auth/apiClient'
import type { Complaint, CreateComplaintRequest, UpdateComplaintRequest } from './types'

export const complaintsService = {
  async list(): Promise<Complaint[]> {
    return apiRequest<Complaint[]>('/complaints')
  },

  async get(id: number): Promise<Complaint> {
    return apiRequest<Complaint>(`/complaints/${id}`)
  },

  async create(payload: CreateComplaintRequest): Promise<Complaint> {
    return apiRequest<Complaint>('/complaints', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async update(id: number, payload: UpdateComplaintRequest): Promise<Complaint> {
    return apiRequest<Complaint>(`/complaints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async remove(id: number): Promise<void> {
    await apiRequest<{ message: string }>(`/complaints/${id}`, { method: 'DELETE' })
  },

  async uploadImage(id: number, image: File): Promise<Complaint> {
    const formData = new FormData()
    formData.append('image', image)
    return apiRequest<Complaint>(`/complaints/${id}/image`, {
      method: 'POST',
      body: formData,
    })
  },

  async removeImage(id: number): Promise<Complaint> {
    return apiRequest<Complaint>(`/complaints/${id}/image`, { method: 'DELETE' })
  },
}
