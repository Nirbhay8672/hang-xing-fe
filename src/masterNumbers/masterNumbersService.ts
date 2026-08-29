import { apiRequest } from '../auth/apiClient'
import type { ManufacturingSpecification } from '../companies/types'
import type { CreateMasterNumberRequest } from './types'

export const masterNumbersService = {
  // The backend attaches the new master number directly onto the matching manufacturing
  // specification (rather than creating a new record), so it hands back that updated
  // specification for the frontend to merge in place.
  async create(payload: CreateMasterNumberRequest): Promise<ManufacturingSpecification> {
    return apiRequest<ManufacturingSpecification>('/master-numbers', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
