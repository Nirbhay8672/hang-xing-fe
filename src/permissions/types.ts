export interface Permission {
  id: number
  name: string
}

export interface PermissionGroup {
  module: string
  permissions: Permission[]
}
