import { useCallback, useEffect, useState } from 'react'
import { deleteRequestsService } from './deleteRequestsService'
import type { DeleteRequestSubject } from './types'

/**
 * Ids of the records of one kind that already have a delete request waiting for approval, so a
 * list can show "request pending" instead of offering to ask again. Only fetched when the
 * current user can actually raise requests.
 */
export function usePendingDeleteRequestIds(subject: DeleteRequestSubject, enabled: boolean) {
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!enabled) return
    deleteRequestsService
      .list('Pending')
      .then((requests) => setPendingIds(new Set(requests.filter((r) => r.subject_type === subject).map((r) => r.subject_id))))
      .catch(() => {})
  }, [subject, enabled])

  const addPending = useCallback((id: number) => {
    setPendingIds((prev) => new Set(prev).add(id))
  }, [])

  return { pendingIds, addPending }
}
