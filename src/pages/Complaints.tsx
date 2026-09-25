import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import { FloatingInput, FloatingSelect, FloatingTextarea } from '../components/FloatingField'
import { useFormErrors } from '../components/formValidation'
import RequestDeleteModal from '../components/RequestDeleteModal'
import { usePendingDeleteRequestIds } from '../deleteRequests/usePendingDeleteRequests'
import '../components/detailView.css'
import '../components/formStyles.css'
import '../components/iconButtons.css'
import Pagination from '../components/Pagination'
import '../components/statusPill.css'
import { usePagination } from '../components/usePagination'
import type { Company } from '../companies/types'
import { companiesService } from '../companies/companiesService'
import type { Complaint, ComplaintImage, ComplaintStatus } from '../complaints/types'
import { complaintsService } from '../complaints/complaintsService'
import type { Problem } from '../problems/types'
import { problemsService } from '../problems/problemsService'
import './Complaints.css'

const STATUS_OPTIONS: ComplaintStatus[] = ['Active', 'Pending', 'Completed']

// Mirrors the API's limits so a bad pick is caught before anything is uploaded.
const MAX_IMAGES = 10
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** A picture picked in the form that hasn't been uploaded yet. */
interface PendingImage {
  file: File
  previewUrl: string
}

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
  const { formErrors, setFormErrors, clearError, showErrors, formRef } = useFormErrors()
  const [submitting, setSubmitting] = useState(false)

  const [resolveTarget, setResolveTarget] = useState<Complaint | null>(null)
  const [resolveForm, setResolveForm] = useState<ResolveFormState>({ status: 'Active', solution: '', result: '' })
  const [resolveErrors, setResolveErrors] = useState<Record<string, string[]>>({})
  const [resolving, setResolving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Complaint | null>(null)
  // People without "delete complaints" (Marketing) can't delete directly — they ask an Admin instead.
  const [requestDeleteTarget, setRequestDeleteTarget] = useState<Complaint | null>(null)
  const canRequestDelete = !can('delete complaints') && can('request delete complaints')
  const { pendingIds: pendingDeleteIds, addPending: addPendingDelete } = usePendingDeleteRequestIds('complaint', canRequestDelete)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [problemModalOpen, setProblemModalOpen] = useState(false)
  const [newProblemName, setNewProblemName] = useState('')
  const [problemError, setProblemError] = useState<string | null>(null)
  const [problemSubmitting, setProblemSubmitting] = useState(false)
  const addProblem = useFormErrors()

  // Pictures are handled via their own dedicated upload/remove endpoints rather than the main
  // create/update payload. keptImages are the ones already saved on the complaint (minus any
  // marked for removal, which are listed in removedImageIds and deleted on save), and newImages
  // are freshly picked files waiting to be uploaded on save.
  const [keptImages, setKeptImages] = useState<ComplaintImage[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([])
  const [newImages, setNewImages] = useState<PendingImage[]>([])
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const imageCount = keptImages.length + newImages.length

  // Full-size view of whichever picture was just clicked — the form's thumbnails and the View
  // modal's gallery open the same lightbox, which steps through that complaint's pictures.
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)

  function stepLightbox(step: number) {
    setLightbox((current) =>
      current && current.urls.length > 1
        ? { ...current, index: (current.index + step + current.urls.length) % current.urls.length }
        : current,
    )
  }

  useEffect(() => {
    if (!lightbox) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setLightbox(null)
      else if (event.key === 'ArrowLeft') stepLightbox(-1)
      else if (event.key === 'ArrowRight') stepLightbox(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightbox])

  // The problem / company a complaint was raised with may have been deleted since. They no longer
  // show up in the lists to pick from, but the complaint keeps them — so they're added back while
  // that complaint is being edited.
  const problemOptions =
    editingComplaint?.problem && !problems.some((p) => p.id === editingComplaint.problem_id)
      ? [...problems, editingComplaint.problem]
      : problems
  const companyOptions =
    editingComplaint?.company && !companies.some((c) => c.id === editingComplaint.company_id)
      ? [...companies, editingComplaint.company]
      : companies

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
    resetImages([])
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
    resetImages(complaint.images ?? [])
    setModalMode('edit')
  }

  /** Starts the form's picture list from scratch (freeing any previews that were still held). */
  function resetImages(saved: ComplaintImage[]) {
    newImages.forEach((image) => URL.revokeObjectURL(image.previewUrl))
    setNewImages([])
    setKeptImages(saved)
    setRemovedImageIds([])
    setUploadProgress(null)
  }

  function handleImageFilesChange(files: FileList | null) {
    if (!files || files.length === 0) return

    const accepted: PendingImage[] = []
    const problems: string[] = []
    let room = MAX_IMAGES - imageCount

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        problems.push(`${file.name}: only image files (JPG, PNG, GIF or WebP) can be attached.`)
      } else if (file.size > MAX_IMAGE_BYTES) {
        problems.push(`${file.name}: must be 5 MB or smaller.`)
      } else if (room <= 0) {
        problems.push(`${file.name}: a complaint can have at most ${MAX_IMAGES} images.`)
      } else {
        accepted.push({ file, previewUrl: URL.createObjectURL(file) })
        room -= 1
      }
    }

    if (problems.length > 0) setFormErrors((prev) => ({ ...prev, image: problems }))
    else clearError('image')
    if (accepted.length > 0) setNewImages((prev) => [...prev, ...accepted])
  }

  function removeNewImage(index: number) {
    setNewImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
    clearError('image')
  }

  function removeSavedImage(image: ComplaintImage) {
    setKeptImages((prev) => prev.filter((i) => i.id !== image.id))
    setRemovedImageIds((prev) => [...prev, image.id])
    clearError('image')
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
    const errors: Record<string, string[]> = {}
    if (!form.problem_id) errors.problem_id = ['Problem is required.']
    if (form.title.trim() === '') errors.title = ['Title is required.']
    else if (form.title.length > 255) errors.title = ['Title must be 255 characters or fewer.']
    if (Object.keys(errors).length > 0) {
      showErrors(errors)
      return
    }
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

      // The complaint now exists, so if a picture fails below the form carries on as an edit of it
      // — pressing Save again finishes the remaining pictures instead of raising a second complaint.
      if (modalMode === 'create') {
        setEditingComplaint(saved)
        setModalMode('edit')
      }

      // Each picture is its own request, and is dropped from the form once it's through, so a retry
      // after a failure only repeats what didn't go through.
      for (const imageId of removedImageIds) {
        saved = await complaintsService.removeImage(saved.id, imageId)
        applySaved(saved)
        setRemovedImageIds((prev) => prev.filter((id) => id !== imageId))
      }
      for (const [index, image] of newImages.entries()) {
        setUploadProgress(newImages.length > 1 ? `Uploading image ${index + 1} of ${newImages.length}…` : 'Uploading image…')
        saved = await complaintsService.addImage(saved.id, image.file)
        applySaved(saved)
        URL.revokeObjectURL(image.previewUrl)
        setNewImages((prev) => prev.filter((p) => p !== image))
        setKeptImages(saved.images)
      }

      setModalMode(null)
    } catch (err) {
      showErrors(extractErrors(err, 'Something went wrong. Please try again.'))
    } finally {
      setSubmitting(false)
      setUploadProgress(null)
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
    addProblem.setFormErrors({})
    setProblemModalOpen(true)
  }

  function closeAddProblemModal() {
    if (problemSubmitting) return
    setProblemModalOpen(false)
  }

  async function handleAddProblem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newProblemName.trim() === '') {
      addProblem.showErrors({ name: ['Problem name is required.'] })
      return
    }
    if (newProblemName.length > 255) {
      addProblem.showErrors({ name: ['Problem name must be 255 characters or fewer.'] })
      return
    }
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
                              {canRequestDelete && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--delete"
                                  aria-label="Request complaint deletion"
                                  title={pendingDeleteIds.has(c.id) ? 'Delete request waiting for admin approval' : 'Request delete'}
                                  disabled={pendingDeleteIds.has(c.id)}
                                  onClick={() => setRequestDeleteTarget(c)}
                                >
                                  <i className={pendingDeleteIds.has(c.id) ? 'la la-hourglass-half' : 'la la-trash'}></i>
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
                    <form ref={formRef} onSubmit={handleSubmit} autoComplete="off" noValidate>
                      {formErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{formErrors[GENERAL_ERROR_KEY][0]}</p>}

                      <div className="row">
                        <div className="col-md-6">
                          <FloatingSelect
                            label="Problem"
                            value={form.problem_id}
                            onChange={(e) => {
                              setForm((f) => ({ ...f, problem_id: e.target.value }))
                              clearError('problem_id')
                            }}
                            error={formErrors.problem_id?.[0]}
                          >
                            <option value="">— Select —</option>
                            {problemOptions.map((p) => (
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
                            {companyOptions.map((co) => (
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
                            onChange={(e) => {
                              setForm((f) => ({ ...f, title: e.target.value }))
                              clearError('title')
                            }}
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
                          <label className="hx-image-picker-label">
                            Images (optional)
                            <span className="hx-image-picker-count">
                              {imageCount} / {MAX_IMAGES}
                            </span>
                          </label>
                          <div className="hx-image-picker">
                            {imageCount > 0 && (
                              <div className="hx-image-picker__grid">
                                {[
                                  ...keptImages.map((image) => ({
                                    key: `saved-${image.id}`,
                                    url: image.url,
                                    remove: () => removeSavedImage(image),
                                  })),
                                  ...newImages.map((image, index) => ({
                                    key: `new-${image.previewUrl}`,
                                    url: image.previewUrl,
                                    remove: () => removeNewImage(index),
                                  })),
                                ].map((thumb, index, all) => (
                                  <div className="hx-image-picker__preview" key={thumb.key}>
                                    <img
                                      src={thumb.url}
                                      alt={`Complaint attachment ${index + 1}`}
                                      className="hx-image-clickable"
                                      onClick={() => setLightbox({ urls: all.map((t) => t.url), index })}
                                    />
                                    <button
                                      type="button"
                                      className="hx-icon-btn hx-icon-btn--delete"
                                      aria-label="Remove image"
                                      title="Remove"
                                      onClick={thumb.remove}
                                      disabled={submitting}
                                    >
                                      <i className="la la-trash"></i>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="form-control"
                              disabled={imageCount >= MAX_IMAGES || submitting}
                              onChange={(e) => {
                                handleImageFilesChange(e.target.files)
                                // Clear the input so picking the same file again still fires a change.
                                e.target.value = ''
                              }}
                            />
                            <span className="hx-image-picker-hint">
                              You can select several images at once — up to {MAX_IMAGES}, 5 MB each.
                            </span>
                          </div>
                          {formErrors.image?.map((message) => (
                            <p className="hx-form-error" key={message}>
                              {message}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div className="button-group d-flex justify-content-center pt-20">
                        <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded me-10" onClick={closeModal} disabled={submitting}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-sm btn-primary btn-rounded" disabled={submitting}>
                          {submitting ? (uploadProgress ?? 'Saving…') : modalMode === 'create' ? 'Raise Complaint' : 'Save Changes'}
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
                  <form ref={addProblem.formRef} onSubmit={handleAddProblem} autoComplete="off" noValidate>
                    {problemError && <p className="hx-form-error">{problemError}</p>}
                    <FloatingInput
                      label="Problem Name"
                      type="text"
                      value={newProblemName}
                      onChange={(e) => {
                        setNewProblemName(e.target.value)
                        addProblem.clearError('name')
                      }}
                      autoFocus
                      error={addProblem.formErrors.name?.[0]}
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
                  <form onSubmit={handleResolveSubmit} autoComplete="off" noValidate>
                    {resolveErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{resolveErrors[GENERAL_ERROR_KEY][0]}</p>}
                    <div className="row">
                      <div className="col-md-6">
                        <FloatingSelect
                          label="Status"
                          value={resolveForm.status}
                          onChange={(e) => setResolveForm((f) => ({ ...f, status: e.target.value as ComplaintStatus }))}
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

                  {viewTarget.images.length > 0 && (
                    <div className="hx-detail-section">
                      <span className="hx-detail-section__title">
                        {viewTarget.images.length === 1 ? 'Image' : `Images (${viewTarget.images.length})`}
                      </span>
                      <div className="hx-complaint-gallery">
                        {viewTarget.images.map((image, index) => (
                          <img
                            key={image.id}
                            src={image.url}
                            alt={`Complaint attachment ${index + 1}`}
                            className="hx-complaint-gallery__img hx-image-clickable"
                            onClick={() => setLightbox({ urls: viewTarget.images.map((i) => i.url), index })}
                          />
                        ))}
                      </div>
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

      {requestDeleteTarget && (
        <RequestDeleteModal
          subject="complaint"
          subjectId={requestDeleteTarget.id}
          label={requestDeleteTarget.complaint_no}
          onClose={() => setRequestDeleteTarget(null)}
          onRequested={(request) => addPendingDelete(request.subject_id)}
        />
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
                    This will delete complaint <strong>{deleteTarget.complaint_no}</strong>. The company, problem and other records it refers to are not affected.
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

      {lightbox && (
        <div className="hx-lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button type="button" className="hx-lightbox__close" onClick={() => setLightbox(null)} aria-label="Close">
            <i className="las la-times"></i>
          </button>
          {lightbox.urls.length > 1 && (
            <button
              type="button"
              className="hx-lightbox__nav hx-lightbox__nav--prev"
              onClick={(e) => {
                e.stopPropagation()
                stepLightbox(-1)
              }}
              aria-label="Previous image"
            >
              <i className="las la-angle-left"></i>
            </button>
          )}
          <img src={lightbox.urls[lightbox.index]} alt="Complaint attachment full size" onClick={(e) => e.stopPropagation()} />
          {lightbox.urls.length > 1 && (
            <button
              type="button"
              className="hx-lightbox__nav hx-lightbox__nav--next"
              onClick={(e) => {
                e.stopPropagation()
                stepLightbox(1)
              }}
              aria-label="Next image"
            >
              <i className="las la-angle-right"></i>
            </button>
          )}
          {lightbox.urls.length > 1 && (
            <span className="hx-lightbox__counter">
              {lightbox.index + 1} / {lightbox.urls.length}
            </span>
          )}
        </div>
      )}
    </AppShell>
  )
}
