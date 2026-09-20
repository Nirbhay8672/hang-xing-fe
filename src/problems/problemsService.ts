import { apiRequest } from '../auth/apiClient'
import type { CreateProblemRequest, Problem, UpdateProblemRequest } from './types'

export const problemsService = {
  async list(): Promise<Problem[]> {
    return apiRequest<Problem[]>('/problems')
  },

  async get(id: number): Promise<Problem> {
    return apiRequest<Problem>(`/problems/${id}`)
  },

  async create(payload: CreateProblemRequest): Promise<Problem> {
    return apiRequest<Problem>('/problems', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async update(id: number, payload: UpdateProblemRequest): Promise<Problem> {
    return apiRequest<Problem>(`/problems/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async remove(id: number): Promise<void> {
    await apiRequest<{ message: string }>(`/problems/${id}`, { method: 'DELETE' })
  },
}
