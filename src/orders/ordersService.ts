import { apiRequest } from '../auth/apiClient'
import type { CreateOrderRequest, Order, UpdateOrderRequest } from './types'

export const ordersService = {
  async list(): Promise<Order[]> {
    return apiRequest<Order[]>('/orders')
  },

  async get(id: number): Promise<Order> {
    return apiRequest<Order>(`/orders/${id}`)
  },

  async create(payload: CreateOrderRequest): Promise<Order> {
    return apiRequest<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async update(id: number, payload: UpdateOrderRequest): Promise<Order> {
    return apiRequest<Order>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async remove(id: number): Promise<void> {
    await apiRequest<{ message: string }>(`/orders/${id}`, { method: 'DELETE' })
  },
}
