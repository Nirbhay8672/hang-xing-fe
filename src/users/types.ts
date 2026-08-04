export interface User {
  id: number
  name: string
  email: string
  role_id: number | null
  roles: string[]
  created_at: string
  updated_at: string
}

export interface CreateUserRequest {
  name: string
  email: string
  password: string
  role_id?: number
}

export interface UpdateUserRequest {
  name?: string
  email?: string
  password?: string
  role_id?: number
}
