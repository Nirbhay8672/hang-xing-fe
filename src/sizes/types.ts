export interface Size {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export interface CreateSizeRequest {
  name: string
}

export type UpdateSizeRequest = CreateSizeRequest
