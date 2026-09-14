import { useState } from 'react'

export interface Pagination<T> {
  page: number
  setPage: (page: number) => void
  totalPages: number
  totalItems: number
  perPage: number
  pageItems: T[]
}

// Purely client-side pagination over an already-filtered/sorted array. `page` is clamped to
// the valid range (so a list that shrinks under the current page, e.g. from a new search or a
// deletion, never leaves the view stranded on a page with nothing on it), and resets to page 1
// whenever the item count changes — including a fresh search narrowing the results, so the
// user isn't left looking at a stale page position for a different filter. The reset is done
// during render (React's documented pattern for adjusting state from a changed prop) rather
// than in an effect, since resetting via an effect would cause an extra render every time.
export function usePagination<T>(items: T[], perPage = 10): Pagination<T> {
  const [page, setPage] = useState(1)
  const [prevTotalItems, setPrevTotalItems] = useState(items.length)

  const totalItems = items.length
  if (totalItems !== prevTotalItems) {
    setPrevTotalItems(totalItems)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * perPage
  const pageItems = items.slice(start, start + perPage)

  return { page: safePage, setPage, totalPages, totalItems, perPage, pageItems }
}
