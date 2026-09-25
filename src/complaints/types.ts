import type { Company } from '../companies/types'
import type { Problem } from '../problems/types'
import type { User } from '../users/types'

export type ComplaintStatus = 'Active' | 'Pending' | 'Completed'

export interface ComplaintImage {
  id: number
  /** Ready-to-use absolute URL. */
  url: string
}

export interface Complaint {
  id: number
  complaint_no: string
  problem_id: number
  problem: Problem
  company_id: number | null
  company: Company | null
  user_id: number
  user: User
  title: string
  description: string | null
  /** Set once someone works the ticket — same record as the original complaint, not a
   * separate row (see the "Update Status" modal in Complaints.tsx). */
  solution: string | null
  result: string | null
  /** Always "Active" on creation; moves to "Pending" then "Completed" from there. */
  status: ComplaintStatus
  /** Pictures attached to the complaint, oldest first — added/removed through the dedicated
   * /complaints/{id}/images endpoints, not through create/update. */
  images: ComplaintImage[]
  created_at: string
  updated_at: string
}

export interface CreateComplaintRequest {
  problem_id: number
  company_id: number | null
  user_id: number
  title: string
  description?: string
}

export interface UpdateComplaintRequest {
  problem_id: number
  company_id: number | null
  title: string
  description?: string
  solution?: string
  result?: string
  status?: ComplaintStatus
}
