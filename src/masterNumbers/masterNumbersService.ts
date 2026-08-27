import { apiRequest } from '../auth/apiClient'
import type { CreateMasterNumberRequest, MasterNumber } from './types'

export const masterNumbersService = {
  async create(payload: CreateMasterNumberRequest): Promise<MasterNumber> {
    return apiRequest<MasterNumber>('/master-numbers', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
