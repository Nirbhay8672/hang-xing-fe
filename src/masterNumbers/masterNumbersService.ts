import { apiRequest } from '../auth/apiClient'
import type { ManufacturingSpecification } from '../companies/types'
import type { CreateMasterNumberRequest } from './types'

export const masterNumbersService = {
  async create(payload: CreateMasterNumberRequest): Promise<ManufacturingSpecification> {
    return apiRequest<ManufacturingSpecification>('/master-numbers', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
