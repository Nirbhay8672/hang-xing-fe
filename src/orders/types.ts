import type { Company } from '../companies/types'
import type { User } from '../users/types'

export interface CompletedTask {
  task: string
  /** When this task was checked off — set by the backend, not the client, so it can't be
   * backdated or affected by the viewer's clock. May be absent on an API that hasn't added
   * this yet; the frontend tolerates that (see normalizeCompletedTask in TrackOrderModal.tsx). */
  completed_at: string
}

export interface PunchNumber {
  id: number
  order_id: number
  punch_number: string
  /** Subset of the order's `planning_tasks` completed for this specific piece, each with a
   * completion timestamp — tracked per punch number since each physical mold moves through
   * production independently. */
  completed_tasks: CompletedTask[]
  created_at: string
  updated_at: string
}

export interface Order {
  id: number
  order_no: string
  company_id: number
  company: Company
  user_id: number
  user: User
  size: string
  /** Which of the company's (possibly several, same-size) manufacturing specification rows
   * this order was generated against — a company can have multiple spec rows sharing one
   * `size` with different master numbers, so `size` alone doesn't uniquely identify them, and
   * more than one can apply (checked via the Size Details table's checkboxes). Empty on
   * orders created before this field existed. */
  specification_ids: number[]
  punch_type: string
  order_type: string
  quantity: number
  punch_numbers: PunchNumber[]
  expected_delivery_date: string
  master_number: string
  /** General order status (e.g. "Pending" / "Planned") shown on the main Orders list. */
  status: string
  /** Separate from `status` — tracks the order's state within the Planning workflow
   * specifically (e.g. "Review" / "Planned"), shown on the Planning page. */
  planning_status: string
  /** Set on the Planning page's "Corrections & Planning Fields" — null until planned. */
  milling_size: string | null
  facing_thickness: string | null
  /** When planning_status last became "Planned" — set server-side, null until planned.
   * Distinct from `updated_at`, which also changes on every later production task update. */
  planned_at?: string | null
  /** Names of the fixed production steps (see TASK_STEPS in PlanOrderModal.tsx) checked
   * off as assigned for this order's plan. */
  planning_tasks: string[]
  planning_remarks: string | null
  /** 0-100 — share of (punch number × assigned task) pairs marked complete on the
   * Production dashboard. Computed server-side; only meaningful once planned. */
  production_progress: number
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface UpdateOrderPlanningRequest {
  size: string
  master_number: string
  milling_size: string
  facing_thickness: string
  planning_tasks: string[]
  planning_remarks: string
  planning_status: string
  /** Only sent for RC orders — finalizes the per-piece punch numbers left optional at
   * order-creation time. Omitted for New orders, whose punch numbers are immutable. */
  punch_numbers?: string[]
}

export interface UpdateOrderProductionRequest {
  punch_numbers: Array<{
    id: number
    completed_tasks: string[]
  }>
}

export interface CreateOrderRequest {
  company_id: number
  user_id: number
  size: string
  /** Which manufacturing specification row(s) (of possibly several sharing this `size`) the
   * order was generated against — omitted when the size has no matching rows to choose from. */
  specification_ids?: number[]
  punch_type: string
  order_type: string
  quantity: number
  expected_delivery_date: string
  master_number: string
  punch_numbers?: string[]
  remarks?: string
}

export type UpdateOrderRequest = CreateOrderRequest
