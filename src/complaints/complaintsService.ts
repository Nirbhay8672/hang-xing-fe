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

  /** Uploads one picture. The app sends pictures one request at a time so a batch of large
   * photos never runs into the server's per-request size limit. */
  async addImage(id: number, image: File): Promise<Complaint> {
    const formData = new FormData()
    formData.append('images[]', image)
    return apiRequest<Complaint>(`/complaints/${id}/images`, {
      method: 'POST',
      body: formData,
    })
  },

  async removeImage(id: number, imageId: number): Promise<Complaint> {
    return apiRequest<Complaint>(`/complaints/${id}/images/${imageId}`, { method: 'DELETE' })
  },
}
