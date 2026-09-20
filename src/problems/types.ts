export interface Problem {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export interface CreateProblemRequest {
  name: string
}

export type UpdateProblemRequest = CreateProblemRequest
