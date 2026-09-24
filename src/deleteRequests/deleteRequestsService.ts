import { apiRequest } from '../auth/apiClient'
import type { CreateDeleteRequestPayload, DeleteRequest, DeleteRequestStatus, NotificationFeed } from './types'

export const deleteRequestsService = {
  async list(status?: DeleteRequestStatus): Promise<DeleteRequest[]> {
    return apiRequest<DeleteRequest[]>(status ? `/delete-requests?status=${status}` : '/delete-requests')
  },

  async create(payload: CreateDeleteRequestPayload): Promise<DeleteRequest> {
    return apiRequest<DeleteRequest>('/delete-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async approve(id: number, reviewNote?: string): Promise<DeleteRequest> {
    return apiRequest<DeleteRequest>(`/delete-requests/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ review_note: reviewNote?.trim() || null }),
    })
  },

  async reject(id: number, reviewNote?: string): Promise<DeleteRequest> {
    return apiRequest<DeleteRequest>(`/delete-requests/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ review_note: reviewNote?.trim() || null }),
    })
  },

  async notifications(): Promise<NotificationFeed> {
    return apiRequest<NotificationFeed>('/notifications')
  },

  async markNotificationsRead(): Promise<void> {
    await apiRequest<void>('/notifications/read', { method: 'POST' })
  },
}
