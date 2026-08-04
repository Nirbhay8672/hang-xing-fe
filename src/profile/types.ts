export interface Profile {
  id: number
  name: string
  email: string
  roles: string[]
  permissions: string[]
  created_at: string
  updated_at: string
}

export interface UpdateProfileRequest {
  name?: string
  email?: string
  current_password?: string
  password?: string
}
