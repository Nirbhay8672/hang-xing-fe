import { useEffect, useState } from 'react'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import { FloatingTextarea } from '../components/FloatingField'
import '../components/formStyles.css'
import Pagination from '../components/Pagination'
import '../components/statusPill.css'
import { usePagination } from '../components/usePagination'
import { deleteRequestsService } from '../deleteRequests/deleteRequestsService'
import { SUBJECT_LABELS, type DeleteRequest, type DeleteRequestStatus } from '../deleteRequests/types'
import './DeleteRequests.css'

type Filter = 'All' | DeleteRequestStatus
const FILTERS: Filter[] = ['Pending', 'Approved', 'Rejected', 'All']

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusPillClass(status: DeleteRequestStatus): string {
  if (status === 'Approved') return 'hx-status-pill--complete'
  if (status === 'Rejected') return 'hx-status-pill--onhold'
  return 'hx-status-pill--pending'
}

interface ReviewState {
  request: DeleteRequest
  action: 'approve' | 'reject'
}

export default function DeleteRequests() {
  const { can } = useAuth()
  const canReview = can('review delete requests')

  const [requests, setRequests] = useState<DeleteRequest[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>(canReview ? 'Pending' : 'All')

  const [review, setReview] = useState<ReviewState | null>(null)
  const [note, setNote] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoadError(null)
    try {
      setRequests(await deleteRequestsService.list())
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load delete requests.')
    }
  }

  function openReview(request: DeleteRequest, action: 'approve' | 'reject') {
    setReview({ request, action })
    setNote('')
    setReviewError(null)
  }

  function closeReview() {
    if (reviewing) return
    setReview(null)
  }

  async function handleReview() {
    if (!review) return
    if (note.length > 1000) {
      setReviewError('The note must be 1000 characters or fewer.')
      return
    }
    setReviewing(true)
    setReviewError(null)
    try {
      const updated =
        review.action === 'approve'
          ? await deleteRequestsService.approve(review.request.id, note)
          : await deleteRequestsService.reject(review.request.id, note)
      setRequests((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? null)
      setReview(null)
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setReviewing(false)
    }
  }

  const counts = (status: Filter) => (status === 'All' ? (requests?.length ?? 0) : (requests?.filter((r) => r.status === status).length ?? 0))
  const filtered = requests?.filter((r) => filter === 'All' || r.status === filter) ?? []
  const { page, setPage, totalPages, totalItems, perPage, pageItems } = usePagination(filtered, 10)

  return (
    <AppShell title="Delete Requests">
      <div className="row">
        <div className="col-12">
          <p className="hx-dr-subtitle">
            {canReview
              ? 'Approve or reject requests to delete orders and complaints. Approving deletes the record.'
              : 'Requests you have sent to an admin to delete an order or complaint, and their decisions.'}
          </p>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="contact-list-wrap mb-25">
            <div className="contact-list bg-white radius-xl w-100">
              <div className="hx-dr-filters">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`hx-dr-filter${filter === f ? ' hx-dr-filter--active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f} <span className="hx-dr-filter__count">{counts(f)}</span>
                  </button>
                ))}
              </div>

              {loadError && <p className="hx-form-error m-20">{loadError}</p>}
              {requests === null && !loadError && <p className="hx-dr-empty">Loading requests…</p>}
              {requests && filtered.length === 0 && (
                <p className="hx-dr-empty">{filter === 'All' ? 'No delete requests yet.' : `No ${filter.toLowerCase()} requests.`}</p>
              )}

              {requests && filtered.length > 0 && (
                <div className="table-responsive">
                  <table className="table mb-0 table-borderless table-rounded">
                    <thead>
                      <tr>
                        <th>
                          <span className="userDatatable-title">Item</span>
                        </th>
                        {canReview && (
                          <th>
                            <span>Requested By</span>
                          </th>
                        )}
                        <th>
                          <span>Reason</span>
                        </th>
                        <th>
                          <span>Requested</span>
                        </th>
                        <th>
                          <span>Status</span>
                        </th>
                        <th>
                          <span>Decision</span>
                        </th>
                        {canReview && (
                          <th className="c-action">
                            <span className="float-right"></span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <span className="hx-dr-type">{SUBJECT_LABELS[r.subject_type]}</span>
                            <span className="position">{r.subject_label}</span>
                          </td>
                          {canReview && (
                            <td>
                              <span className="position">{r.requester?.name ?? '—'}</span>
                            </td>
                          )}
                          <td>
                            <span className="position hx-dr-text">{r.reason || '—'}</span>
                          </td>
                          <td>
                            <span className="position">{formatDateTime(r.created_at)}</span>
                          </td>
                          <td>
                            <span className={`hx-status-pill ${statusPillClass(r.status)}`}>{r.status}</span>
                          </td>
                          <td>
                            {r.status === 'Pending' ? (
                              <span className="position">—</span>
                            ) : (
                              <div className="hx-dr-decision">
                                <span className="position">
                                  {r.reviewer?.name ?? '—'}
                                  {r.reviewed_at && <span className="hx-dr-decision__date"> · {formatDateTime(r.reviewed_at)}</span>}
                                </span>
                                {r.review_note && <span className="hx-dr-decision__note">{r.review_note}</span>}
                              </div>
                            )}
                          </td>
                          {canReview && (
                            <td>
                              {r.status === 'Pending' && (
                                <div className="table-actions d-flex hx-dr-actions">
                                  <button
                                    type="button"
                                    className="btn btn-sm hx-btn-secondary btn-rounded"
                                    onClick={() => openReview(r, 'reject')}
                                  >
                                    Reject
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary btn-rounded"
                                    onClick={() => openReview(r, 'approve')}
                                  >
                                    Approve
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination page={page} totalPages={totalPages} totalItems={totalItems} perPage={perPage} onPageChange={setPage} />
            </div>
          </div>
        </div>
      </div>

      {review && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">
                    {review.action === 'approve' ? 'Approve deletion?' : 'Reject request?'}
                  </h6>
                  <button type="button" className="btn-close" onClick={closeReview} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="hx-modal-text">
                    {review.request.requester?.name ?? 'Someone'} asked to delete{' '}
                    {SUBJECT_LABELS[review.request.subject_type].toLowerCase()} <strong>{review.request.subject_label}</strong>.
                  </p>
                  {review.request.reason && <p className="hx-dr-quote">“{review.request.reason}”</p>}
                  <p className="hx-modal-text">
                    {review.action === 'approve'
                      ? `Approving deletes this ${SUBJECT_LABELS[review.request.subject_type].toLowerCase()}. The records it refers to are not affected.`
                      : `The ${SUBJECT_LABELS[review.request.subject_type].toLowerCase()} stays as it is and the requester is told the request was rejected.`}
                  </p>
                  {reviewError && <p className="hx-form-error">{reviewError}</p>}
                  <FloatingTextarea
                    label="Note to the requester (optional)"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={reviewing}
                  />
                  <div className="button-group d-flex justify-content-center pt-10">
                    <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded me-10" onClick={closeReview} disabled={reviewing}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm btn-rounded ${review.action === 'approve' ? 'btn-danger' : 'btn-primary'}`}
                      onClick={handleReview}
                      disabled={reviewing}
                    >
                      {reviewing ? 'Saving…' : review.action === 'approve' ? 'Approve & Delete' : 'Reject Request'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeReview}></div>
        </>
      )}
    </AppShell>
  )
}
