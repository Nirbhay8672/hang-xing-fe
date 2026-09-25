export interface RoleUser {
  id: number
  name: string
}

export interface Role {
  id: number
  name: string
  /** People currently holding this role. */
  users: RoleUser[]
  created_at: string
  updated_at: string
}
