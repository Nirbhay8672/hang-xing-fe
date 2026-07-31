import { apiRequest } from '../auth/apiClient'
import type { Company, CreateCompanyRequest, UpdateCompanyRequest } from './types'

export const companiesService = {
  async list(): Promise<Company[]> {
    return apiRequest<Company[]>('/companies')
  },

  async get(id: number): Promise<Company> {
    return apiRequest<Company>(`/companies/${id}`)
  },

  async create(payload: CreateCompanyRequest): Promise<Company> {
    return apiRequest<Company>('/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async update(id: number, payload: UpdateCompanyRequest): Promise<Company> {
    return apiRequest<Company>(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async remove(id: number): Promise<void> {
    await apiRequest<{ message: string }>(`/companies/${id}`, { method: 'DELETE' })
  },
}
