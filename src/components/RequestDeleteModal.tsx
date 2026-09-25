import { useState, type FormEvent } from 'react'
import { ApiError } from '../auth/apiClient'
import { deleteRequestsService } from '../deleteRequests/deleteRequestsService'
import { SUBJECT_LABELS, type DeleteRequest, type DeleteRequestSubject } from '../deleteRequests/types'
import { FloatingTextarea } from './FloatingField'
import './formStyles.css'

interface RequestDeleteModalProps {
  subject: DeleteRequestSubject
  subjectId: number
  /** What to call the record in the dialog, e.g. an order number. */
  label: string
  onClose: () => void
  onRequested: (request: DeleteRequest) => void
}

/**
 * Asks an Admin to delete a record instead of deleting it directly — for roles (Marketing)
 * that can't delete on their own. Nothing is deleted until an Admin approves the request.
 */
export default function RequestDeleteModal({ subject, subjectId, label, onClose, onRequested }: RequestDeleteModalProps) {
  const noun = SUBJECT_LABELS[subject].toLowerCase()
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (reason.length > 1000) {
      setReasonError('The reason must be 1000 characters or fewer.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const created = await deleteRequestsService.create({
        subject_type: subject,
        subject_id: subjectId,
        reason: reason.trim() || undefined,
      })
      onRequested(created)
      setSent(true)
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to send the request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    if (submitting) return
    onClose()
  }

  return (
    <>
      <div className="modal fade show d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content radius-xl">
            <div className="modal-header">
              <h6 className="modal-title fw-500">{sent ? 'Request sent' : `Request to delete ${noun}`}</h6>
              <button type="button" className="btn-close" onClick={handleClose} aria-label="Close">
                <i className="las la-times"></i>
              </button>
            </div>
            <div className="modal-body">
              {sent ? (
                <>
                  <p className="hx-form-success">
                    Your request to delete <strong>{label}</strong> was sent to an admin. It is only deleted once they approve it —
                    you'll be notified of their decision.
                  </p>
                  <div className="button-group d-flex justify-content-center pt-10">
                    <button type="button" className="btn btn-sm btn-primary btn-rounded" onClick={onClose}>
                      Done
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSubmit} autoComplete="off" noValidate>
                  <p className="hx-modal-text">
                    You can't delete {noun} <strong>{label}</strong> yourself. Send a request and an admin will approve or reject it.
                  </p>
                  {submitError && <p className="hx-form-error">{submitError}</p>}
                  <FloatingTextarea
                    label="Reason (optional)"
                    rows={3}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value)
                      setReasonError(null)
                    }}
                    error={reasonError ?? undefined}
                    autoFocus
                  />
                  <div className="button-group d-flex justify-content-center pt-10">
                    <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded me-10" onClick={handleClose} disabled={submitting}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-sm btn-danger btn-rounded" disabled={submitting}>
                      {submitting ? 'Sending…' : 'Send Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={handleClose}></div>
    </>
  )
}
