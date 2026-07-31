import type { Company } from '../companies/types'
import type { User } from '../users/types'

export interface Order {
  id: number
  order_no: string
  company_id: number
  company: Company
  user_id: number
  user: User
  size: string
  punch_type: string
  order_type: string
  quantity: number
  punch_numbers: string[]
  expected_delivery_date: string
  master_number: string
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface CreateOrderRequest {
  company_id: number
  user_id: number
  size: string
  punch_type: string
  order_type: string
  quantity: number
  expected_delivery_date: string
  master_number: string
  remarks?: string
}

export type UpdateOrderRequest = CreateOrderRequest
