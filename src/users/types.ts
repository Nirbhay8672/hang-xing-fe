export interface User {
  id: number
  name: string
  email: string
  role_id: number | null
  roles: string[]
  /** Hears about each newly booked order (bell + desktop alert). */
  notify_new_orders: boolean
  created_at: string
  updated_at: string
}

export interface CreateUserRequest {
  name: string
  email: string
  password: string
  role_id?: number
  notify_new_orders?: boolean
}

export interface UpdateUserRequest {
  name?: string
  email?: string
  password?: string
  role_id?: number
  notify_new_orders?: boolean
}
