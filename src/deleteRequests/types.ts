export type DeleteRequestSubject = 'order' | 'complaint'
export type DeleteRequestStatus = 'Pending' | 'Approved' | 'Rejected'

export interface DeleteRequestUser {
  id: number
  name: string
}

export interface DeleteRequest {
  id: number
  requested_by: number
  requester: DeleteRequestUser | null
  subject_type: DeleteRequestSubject
  subject_id: number
  /** Readable snapshot of the record (e.g. "HX/26/09/105 — Acme Ltd") — still meaningful after
   * an approved request has deleted the record itself. */
  subject_label: string
  reason: string | null
  status: DeleteRequestStatus
  reviewed_by: number | null
  reviewer: DeleteRequestUser | null
  reviewed_at: string | null
  review_note: string | null
  requester_seen_at: string | null
  created_at: string
}

export interface CreateDeleteRequestPayload {
  subject_type: DeleteRequestSubject
  subject_id: number
  reason?: string
}

/** What the header bell shows: requests waiting on the user's review (Admin) plus decisions on
 * requests they raised, and the combined unread badge count. */
export interface NotificationFeed {
  pending_reviews: DeleteRequest[]
  decisions: DeleteRequest[]
  unread_count: number
}

export const SUBJECT_LABELS: Record<DeleteRequestSubject, string> = {
  order: 'Order',
  complaint: 'Complaint',
}
