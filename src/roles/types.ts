export interface Role {
  id: number
  name: string
  permissions: string[]
  created_at: string
  updated_at: string
}

export interface CreateRoleRequest {
  name: string
  permissions: string[]
}

export interface UpdateRoleRequest {
  name?: string
  permissions?: string[]
}
