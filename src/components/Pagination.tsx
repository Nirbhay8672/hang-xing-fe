import { Fragment } from 'react'
import './Pagination.css'

interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  perPage: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalPages, totalItems, perPage, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const start = (page - 1) * perPage + 1
  const end = Math.min(page * perPage, totalItems)

  // Always show the first, last, current, and immediate-neighbor pages — collapse everything
  // else into an ellipsis so this stays compact no matter how many pages there are.
  const pageNumbers = Array.from(
    new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages)),
  ).sort((a, b) => a - b)

  return (
    <div className="hx-pagination">
      <span className="hx-pagination__summary">
        Showing {start}–{end} of {totalItems}
      </span>
      <div className="hx-pagination__controls">
        <button
          type="button"
          className="hx-pagination__btn"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <i className="la la-angle-left"></i>
        </button>
        {pageNumbers.map((p, i) => (
          <Fragment key={p}>
            {i > 0 && p - pageNumbers[i - 1] > 1 && <span className="hx-pagination__ellipsis">…</span>}
            <button
              type="button"
              className={`hx-pagination__btn ${p === page ? 'hx-pagination__btn--active' : ''}`}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          </Fragment>
        ))}
        <button
          type="button"
          className="hx-pagination__btn"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <i className="la la-angle-right"></i>
        </button>
      </div>
    </div>
  )
}
