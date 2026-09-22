import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import { FloatingInput, FloatingSelect, FloatingTextarea } from '../components/FloatingField'
import '../components/detailView.css'
import '../components/formStyles.css'
import '../components/iconButtons.css'
import Pagination from '../components/Pagination'
import '../components/statusPill.css'
import { usePagination } from '../components/usePagination'
import type { Company } from '../companies/types'
import { companiesService } from '../companies/companiesService'
import type { Complaint, ComplaintStatus } from '../complaints/types'
import { complaintsService } from '../complaints/complaintsService'
import type { Problem } from '../problems/types'
import { problemsService } from '../problems/problemsService'
import './Complaints.css'

const STATUS_OPTIONS: ComplaintStatus[] = ['Active', 'Pending', 'Completed']

function statusPillClass(status: ComplaintStatus): string {
  switch (status) {
    case 'Completed':
      return 'hx-status-pill--complete'
    case 'Pending':
      return 'hx-status-pill--pending'
    default:
      return 'hx-status-pill--active'
  }
}

interface ComplaintFormState {
  problem_id: string
  company_id: string
  title: string
  description: string
}

const EMPTY_FORM: ComplaintFormState = {
  problem_id: '',
  company_id: '',
  title: '',
  description: '',
}

interface ResolveFormState {
  status: ComplaintStatus
  solution: string
  result: string
}

const GENERAL_ERROR_KEY = '_general'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function extractErrors(error: unknown, fallback: string): Record<string, string[]> {
  if (error instanceof ApiError) {
    if (error.body?.errors) return error.body.errors
    return { [GENERAL_ERROR_KEY]: [error.body?.message ?? fallback] }
  }
  return { [GENERAL_ERROR_KEY]: [fallback] }
}

export default function Complaints() {
  const { can, user } = useAuth()
  const [complaints, setComplaints] = useState<Complaint[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [problems, setProblems] = useState<Problem[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  const [viewTarget, setViewTarget] = useState<Complaint | null>(null)

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingComplaint, setEditingComplaint] = useState<Complaint | null>(null)
  const [form, setForm] = useState<ComplaintFormState>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)

  const [resolveTarget, setResolveTarget] = useState<Complaint | null>(null)
  const [resolveForm, setResolveForm] = useState<ResolveFormState>({ status: 'Active', solution: '', result: '' })
  const [resolveErrors, setResolveErrors] = useState<Record<string, string[]>>({})
  const [resolving, setResolving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Complaint | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [problemModalOpen, setProblemModalOpen] = useState(false)
  const [newProblemName, setNewProblemName] = useState('')
  const [problemError, setProblemError] = useState<string | null>(null)
  const [problemSubmitting, setProblemSubmitting] = useState(false)

  // Image is handled via its own dedicated upload/remove endpoints rather than the main
  // create/update payload — imageFile is a newly picked file waiting to be uploaded on save,
  // imagePreviewUrl is what to show right now (the new file, the existing saved image, or
  // nothing), and removeImageFlag marks that the existing saved image should be deleted on save.
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [removeImageFlag, setRemoveImageFlag] = useState(false)

  // Full-size view of whichever complaint image was just clicked — the form's small picker
  // preview and the View modal's image both open the same lightbox.
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  useEffect(() => {
    loadComplaints()
    problemsService.list().then(setProblems).catch(() => setProblems([]))
    companiesService.list().then(setCompanies).catch(() => setCompanies([]))
  }, [])

  async function loadComplaints() {
    setLoadError(null)
    try {
      const data = await complaintsService.list()
      setComplaints(data)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load complaints.')
    }
  }

  function openCreateModal() {
    setEditingComplaint(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setImageFile(null)
    setImagePreviewUrl(null)
    setRemoveImageFlag(false)
    setModalMode('create')
  }

  function openEditModal(complaint: Complaint) {
    setEditingComplaint(complaint)
    setForm({
      problem_id: String(complaint.problem_id),
      company_id: complaint.company_id ? String(complaint.company_id) : '',
      title: complaint.title,
      description: complaint.description ?? '',
    })
    setFormErrors({})
    setImageFile(null)
    setImagePreviewUrl(complaint.image_url)
    setRemoveImageFlag(false)
    setModalMode('edit')
  }

  function handleImageFileChange(file: File | null) {
    setImageFile(file)
    setRemoveImageFlag(false)
    setImagePreviewUrl(file ? URL.createObjectURL(file) : (editingComplaint?.image_url ?? null))
  }

  function handleRemoveImageClick() {
    setImageFile(null)
    setImagePreviewUrl(null)
    setRemoveImageFlag(true)
  }

  function closeModal() {
    if (submitting) return
    setModalMode(null)
  }

  function openDeleteModal(complaint: Complaint) {
    setDeleteTarget(complaint)
    setDeleteError(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await complaintsService.remove(deleteTarget.id)
      setComplaints((prev) => prev?.filter((c) => c.id !== deleteTarget.id) ?? null)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete complaint.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormErrors({})
    try {
      const basePayload = {
        problem_id: Number(form.problem_id),
        company_id: form.company_id ? Number(form.company_id) : null,
        title: form.title,
        description: form.description || undefined,
      }
      let saved: Complaint
      if (modalMode === 'edit' && editingComplaint) {
        saved = await complaintsService.update(editingComplaint.id, basePayload)
      } else {
        saved = await complaintsService.create({ ...basePayload, user_id: user!.id })
      }

      // Commit the main record right away — image handling below is best-effort on top of an
      // already-saved complaint, so a failure there shouldn't make the whole submission look
      // like it silently did nothing (the record would otherwise be missing from the list
      // until the next reload, despite existing on the server). Checking for an existing id
      // (rather than branching on modalMode) keeps this safe to call again after the image
      // step without inserting a duplicate row.
      const applySaved = (next: Complaint) =>
        setComplaints((prev) => {
          if (!prev) return [next]
          return prev.some((c) => c.id === next.id) ? prev.map((c) => (c.id === next.id ? next : c)) : [next, ...prev]
        })
      applySaved(saved)

      if (imageFile) {
        saved = await complaintsService.uploadImage(saved.id, imageFile)
        applySaved(saved)
      } else if (removeImageFlag) {
        saved = await complaintsService.removeImage(saved.id)
        applySaved(saved)
      }

      setModalMode(null)
    } catch (err) {
      setFormErrors(extractErrors(err, 'Something went wrong. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  function openResolveModal(complaint: Complaint) {
    setResolveForm({ status: complaint.status, solution: complaint.solution ?? '', result: complaint.result ?? '' })
    setResolveErrors({})
    setResolveTarget(complaint)
  }

  function closeResolveModal() {
    if (resolving) return
    setResolveTarget(null)
  }

  async function handleResolveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resolveTarget) return
    setResolving(true)
    setResolveErrors({})
    try {
      const updated = await complaintsService.update(resolveTarget.id, {
        problem_id: resolveTarget.problem_id,
        company_id: resolveTarget.company_id,
        title: resolveTarget.title,
        description: resolveTarget.description ?? undefined,
        solution: resolveForm.solution || undefined,
        result: resolveForm.result || undefined,
        status: resolveForm.status,
      })
      setComplaints((prev) => prev?.map((c) => (c.id === updated.id ? updated : c)) ?? null)
      setResolveTarget(null)
    } catch (err) {
      setResolveErrors(extractErrors(err, 'Failed to update complaint.'))
    } finally {
      setResolving(false)
    }
  }

  function openAddProblemModal() {
    setNewProblemName('')
    setProblemError(null)
    setProblemModalOpen(true)
  }

  function closeAddProblemModal() {
    if (problemSubmitting) return
    setProblemModalOpen(false)
  }

  async function handleAddProblem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProblemSubmitting(true)
    setProblemError(null)
    try {
      const created = await problemsService.create({ name: newProblemName })
      setProblems((prev) => [...prev, created])
      setForm((f) => ({ ...f, problem_id: String(created.id) }))
      setProblemModalOpen(false)
    } catch (err) {
      setProblemError(err instanceof ApiError ? err.message : 'Failed to add problem.')
    } finally {
      setProblemSubmitting(false)
    }
  }

  const filteredComplaints = complaints?.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      c.complaint_no?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q) ||
      c.problem?.name.toLowerCase().includes(q) ||
      c.company?.name.toLowerCase().includes(q)
    )
  })

  const {
    page: complaintsPage,
    setPage: setComplaintsPage,
    totalPages: complaintsTotalPages,
    totalItems: complaintsTotalItems,
    perPage: complaintsPerPage,
    pageItems: pagedComplaints,
  } = usePagination(filteredComplaints ?? [], 10)

  const headerActions = (
    <>
      <div className="action-btn">
        <div className="form-group mb-0">
          <div className="input-container icon-left position-relative">
            <span className="input-icon icon-left">
              <i className="la la-search"></i>
            </span>
            <input
              type="text"
              className="form-control form-control-default"
              placeholder="Search complaints"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="action-btn">
        <button type="button" className="btn btn-sm btn-primary btn-add" onClick={openCreateModal} aria-label="Add New">
          <i className="la la-plus"></i>
        </button>
      </div>
    </>
  )

  return (
    <AppShell title="Complaints" actions={headerActions}>
      <div className="row">
        <div className="col-12">
          <div className="contact-list-wrap mb-25">
            <div className="contact-list bg-white radius-xl w-100">
              {loadError && <p className="hx-form-error m-20">{loadError}</p>}
              {complaints === null && !loadError && <p className="hx-complaints-empty">Loading complaints…</p>}
              {filteredComplaints && filteredComplaints.length === 0 && (
                <p className="hx-complaints-empty">No complaints found.</p>
              )}

              {filteredComplaints && filteredComplaints.length > 0 && (
                <div className="table-responsive">
                  <table className="table mb-0 table-borderless table-rounded">
                    <thead>
                      <tr>
                        <th>
                          <span className="userDatatable-title">Complaint No.</span>
                        </th>
                        <th>
                          <span>Title</span>
                        </th>
                        <th>
                          <span>Problem</span>
                        </th>
                        <th>
                          <span>Company</span>
                        </th>
                        <th>
                          <span>Raised</span>
                        </th>
                        <th>
                          <span>Status</span>
                        </th>
                        <th className="c-action">
                          <span className="float-right"></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedComplaints.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <span className="position">{c.complaint_no}</span>
                          </td>
                          <td>
                            <span className="position">{c.title}</span>
                          </td>
                          <td>
                            <span className="hx-order-badge">{c.problem?.name}</span>
                          </td>
                          <td>
                            <span className="position">{c.company?.name ?? '—'}</span>
                          </td>
                          <td>
                            <span className="position">{formatDate(c.created_at)}</span>
                          </td>
                          <td>
                            <span className={`hx-status-pill ${statusPillClass(c.status)}`}>{c.status}</span>
                          </td>
                          <td>
                            <div className="table-actions d-flex">
                              <button
                                type="button"
                                className="hx-icon-btn hx-icon-btn--view"
                                aria-label="View complaint"
                                title="View"
                                onClick={() => setViewTarget(c)}
                              >
                                <i className="la la-eye"></i>
                              </button>
                              {can('edit complaints') && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--resolve"
                                  aria-label="Update status / solution"
                                  title="Update Status &amp; Solution"
                                  onClick={() => openResolveModal(c)}
                                >
                                  <i className="la la-check-circle"></i>
                                </button>
                              )}
                              {can('edit complaints') && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--edit"
                                  aria-label="Edit complaint"
                                  title="Edit"
                                  onClick={() => openEditModal(c)}
                                >
                                  <i className="la la-edit"></i>
                                </button>
                              )}
                              {can('delete complaints') && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--delete"
                                  aria-label="Delete complaint"
                                  title="Delete"
                                  onClick={() => openDeleteModal(c)}
                                >
                                  <i className="la la-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination
                page={complaintsPage}
                totalPages={complaintsTotalPages}
                totalItems={complaintsTotalItems}
                perPage={complaintsPerPage}
                onPageChange={setComplaintsPage}
              />
            </div>
          </div>
        </div>
      </div>

      {modalMode && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">{modalMode === 'create' ? 'Raise New Complaint' : 'Edit Complaint'}</h6>
                  <button type="button" className="btn-close" onClick={closeModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="add-new-contact">
                    <form onSubmit={handleSubmit} autoComplete="off">
                      {formErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{formErrors[GENERAL_ERROR_KEY][0]}</p>}

                      <div className="row">
                        <div className="col-md-6">
                          <FloatingSelect
                            label="Problem"
                            value={form.problem_id}
                            onChange={(e) => setForm((f) => ({ ...f, problem_id: e.target.value }))}
                            required
                            error={formErrors.problem_id?.[0]}
                          >
                            <option value="">— Select —</option>
                            {problems.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </FloatingSelect>
                          <button type="button" className="hx-add-problem-btn mb-4" onClick={openAddProblemModal}>
                            <i className="la la-plus"></i> Add New Problem
                          </button>
                        </div>
                        <div className="col-md-6">
                          <FloatingSelect
                            label="Company (optional)"
                            value={form.company_id}
                            onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}
                            error={formErrors.company_id?.[0]}
                          >
                            <option value="">— None —</option>
                            {companies.map((co) => (
                              <option key={co.id} value={co.id}>
                                {co.name}
                              </option>
                            ))}
                          </FloatingSelect>
                        </div>
                        <div className="col-12">
                          <FloatingInput
                            label="Title"
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                            required
                            error={formErrors.title?.[0]}
                          />
                        </div>
                        <div className="col-12">
                          <FloatingTextarea
                            label="Description"
                            rows={4}
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            error={formErrors.description?.[0]}
                          />
                        </div>
                        <div className="col-12">
                          <label className="hx-image-picker-label">Image (optional)</label>
                          <div className="hx-image-picker">
                            {imagePreviewUrl && (
                              <div className="hx-image-picker__preview">
                                <img
                                  src={imagePreviewUrl}
                                  alt="Complaint attachment preview"
                                  className="hx-image-clickable"
                                  onClick={() => setLightboxUrl(imagePreviewUrl)}
                                />
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--delete"
                                  aria-label="Remove image"
                                  title="Remove"
                                  onClick={handleRemoveImageClick}
                                >
                                  <i className="la la-trash"></i>
                                </button>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="form-control"
                              onChange={(e) => handleImageFileChange(e.target.files?.[0] ?? null)}
                            />
                          </div>
                          {formErrors.image?.[0] && <p className="hx-form-error">{formErrors.image[0]}</p>}
                        </div>
                      </div>

                      <div className="button-group d-flex justify-content-center pt-20">
                        <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded me-10" onClick={closeModal} disabled={submitting}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-sm btn-primary btn-rounded" disabled={submitting}>
                          {submitting ? 'Saving…' : modalMode === 'create' ? 'Raise Complaint' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeModal}></div>
        </>
      )}

      {problemModalOpen && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Add New Problem</h6>
                  <button type="button" className="btn-close" onClick={closeAddProblemModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleAddProblem} autoComplete="off">
                    {problemError && <p className="hx-form-error">{problemError}</p>}
                    <FloatingInput
                      label="Problem Name"
                      type="text"
                      value={newProblemName}
                      onChange={(e) => setNewProblemName(e.target.value)}
                      required
                      autoFocus
                    />
                    <div className="button-group d-flex justify-content-center pt-20">
                      <button
                        type="button"
                        className="btn btn-sm hx-btn-secondary btn-rounded me-10"
                        onClick={closeAddProblemModal}
                        disabled={problemSubmitting}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-sm btn-primary btn-rounded" disabled={problemSubmitting}>
                        {problemSubmitting ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeAddProblemModal}></div>
        </>
      )}

      {resolveTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">{resolveTarget.complaint_no} — Update Status</h6>
                  <button type="button" className="btn-close" onClick={closeResolveModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleResolveSubmit} autoComplete="off">
                    {resolveErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{resolveErrors[GENERAL_ERROR_KEY][0]}</p>}
                    <div className="row">
                      <div className="col-md-6">
                        <FloatingSelect
                          label="Status"
                          value={resolveForm.status}
                          onChange={(e) => setResolveForm((f) => ({ ...f, status: e.target.value as ComplaintStatus }))}
                          required
                          error={resolveErrors.status?.[0]}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </FloatingSelect>
                      </div>
                      <div className="col-12">
                        <FloatingTextarea
                          label="Solution"
                          rows={3}
                          value={resolveForm.solution}
                          onChange={(e) => setResolveForm((f) => ({ ...f, solution: e.target.value }))}
                          error={resolveErrors.solution?.[0]}
                        />
                      </div>
                      <div className="col-12">
                        <FloatingTextarea
                          label="Result"
                          rows={3}
                          value={resolveForm.result}
                          onChange={(e) => setResolveForm((f) => ({ ...f, result: e.target.value }))}
                          error={resolveErrors.result?.[0]}
                        />
                      </div>
                    </div>
                    <div className="button-group d-flex justify-content-center pt-20">
                      <button
                        type="button"
                        className="btn btn-sm hx-btn-secondary btn-rounded me-10"
                        onClick={closeResolveModal}
                        disabled={resolving}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-sm btn-primary btn-rounded" disabled={resolving}>
                        {resolving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeResolveModal}></div>
        </>
      )}

      {viewTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Complaint Details</h6>
                  <button type="button" className="btn-close" onClick={() => setViewTarget(null)} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">{viewTarget.complaint_no}</span>
                    <div className="hx-detail-grid">
                      <div>
                        <span className="hx-detail-grid__label">Title</span>
                        <span className="hx-detail-grid__value">{viewTarget.title}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Problem</span>
                        <span className="hx-detail-grid__value">{viewTarget.problem?.name}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Company</span>
                        <span className="hx-detail-grid__value">{viewTarget.company?.name ?? '—'}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Raised By</span>
                        <span className="hx-detail-grid__value">{viewTarget.user?.name}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Raised On</span>
                        <span className="hx-detail-grid__value">{formatDate(viewTarget.created_at)}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Status</span>
                        <span className={`hx-status-pill ${statusPillClass(viewTarget.status)}`}>{viewTarget.status}</span>
                      </div>
                      <div className="hx-detail-grid__full">
                        <span className="hx-detail-grid__label">Description</span>
                        <span className="hx-detail-grid__value">{viewTarget.description || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {viewTarget.image_url && (
                    <div className="hx-detail-section">
                      <span className="hx-detail-section__title">Image</span>
                      <img
                        src={viewTarget.image_url}
                        alt="Complaint attachment"
                        className="hx-complaint-detail-image hx-image-clickable"
                        onClick={() => setLightboxUrl(viewTarget.image_url)}
                      />
                    </div>
                  )}

                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Resolution</span>
                    <div className="hx-detail-grid">
                      <div className="hx-detail-grid__full">
                        <span className="hx-detail-grid__label">Solution</span>
                        <span className="hx-detail-grid__value">{viewTarget.solution || '—'}</span>
                      </div>
                      <div className="hx-detail-grid__full">
                        <span className="hx-detail-grid__label">Result</span>
                        <span className="hx-detail-grid__value">{viewTarget.result || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="button-group d-flex justify-content-center pt-20">
                    <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded" onClick={() => setViewTarget(null)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setViewTarget(null)}></div>
        </>
      )}

      {deleteTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Delete complaint?</h6>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => !deleting && setDeleteTarget(null)}
                    aria-label="Close"
                  >
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <p>
                    This will permanently delete complaint <strong>{deleteTarget.complaint_no}</strong>. This cannot be undone.
                  </p>
                  {deleteError && <p className="hx-form-error">{deleteError}</p>}
                  <div className="button-group d-flex justify-content-center pt-20">
                    <button
                      type="button"
                      className="btn btn-sm hx-btn-secondary btn-rounded me-10"
                      onClick={() => setDeleteTarget(null)}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button type="button" className="btn btn-sm btn-danger btn-rounded" onClick={handleDelete} disabled={deleting}>
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => !deleting && setDeleteTarget(null)}></div>
        </>
      )}

      {lightboxUrl && (
        <div className="hx-lightbox" role="dialog" aria-modal="true" onClick={() => setLightboxUrl(null)}>
          <button type="button" className="hx-lightbox__close" onClick={() => setLightboxUrl(null)} aria-label="Close">
            <i className="las la-times"></i>
          </button>
          <img src={lightboxUrl} alt="Complaint attachment full size" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </AppShell>
  )
}
