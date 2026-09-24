import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import { FloatingInput } from '../components/FloatingField'
import { useFormErrors } from '../components/formValidation'
import '../components/detailView.css'
import '../components/formStyles.css'
import '../components/iconButtons.css'
import Pagination from '../components/Pagination'
import { usePagination } from '../components/usePagination'
import type { Size } from '../sizes/types'
import { sizesService } from '../sizes/sizesService'
import { sortSizes } from '../sizes/sortSizes'
import './Sizes.css'

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

export default function Sizes() {
  const { can } = useAuth()
  const [sizes, setSizes] = useState<Size[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingSize, setEditingSize] = useState<Size | null>(null)
  const [name, setName] = useState('')
  const { formErrors, setFormErrors, clearError, showErrors, formRef } = useFormErrors()
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Size | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadSizes()
  }, [])

  async function loadSizes() {
    setLoadError(null)
    try {
      const data = await sizesService.list()
      setSizes(data)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load sizes.')
    }
  }

  function openCreateModal() {
    setEditingSize(null)
    setName('')
    setFormErrors({})
    setModalMode('create')
  }

  function openEditModal(size: Size) {
    setEditingSize(size)
    setName(size.name)
    setFormErrors({})
    setModalMode('edit')
  }

  function closeModal() {
    if (submitting) return
    setModalMode(null)
  }

  function openDeleteModal(size: Size) {
    setDeleteTarget(size)
    setDeleteError(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await sizesService.remove(deleteTarget.id)
      setSizes((prev) => prev?.filter((s) => s.id !== deleteTarget.id) ?? null)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete size.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim() === '') {
      showErrors({ name: ['Size is required.'] })
      return
    }
    if (name.length > 255) {
      showErrors({ name: ['Size must be 255 characters or fewer.'] })
      return
    }
    setSubmitting(true)
    setFormErrors({})
    try {
      if (modalMode === 'edit' && editingSize) {
        const updated = await sizesService.update(editingSize.id, { name })
        setSizes((prev) => (prev ? sortSizes(prev.map((s) => (s.id === updated.id ? updated : s))) : null))
      } else {
        const created = await sizesService.create({ name })
        setSizes((prev) => sortSizes(prev ? [...prev, created] : [created]))
      }
      setModalMode(null)
    } catch (err) {
      showErrors(extractErrors(err, 'Something went wrong. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const filteredSizes = sizes?.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))

  const {
    page: sizesPage,
    setPage: setSizesPage,
    totalPages: sizesTotalPages,
    totalItems: sizesTotalItems,
    perPage: sizesPerPage,
    pageItems: pagedSizes,
  } = usePagination(filteredSizes ?? [], 10)

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
              placeholder="Search sizes"
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
    <AppShell title="Sizes" actions={headerActions}>
      <div className="row">
        <div className="col-12">
          <div className="contact-list-wrap mb-25">
            <div className="contact-list bg-white radius-xl w-100">
              {loadError && <p className="hx-form-error m-20">{loadError}</p>}
              {sizes === null && !loadError && <p className="hx-sizes-empty">Loading sizes…</p>}
              {filteredSizes && filteredSizes.length === 0 && (
                <p className="hx-sizes-empty">No sizes found.</p>
              )}

              {filteredSizes && filteredSizes.length > 0 && (
                <div className="table-responsive">
                  <table className="table mb-0 table-borderless table-rounded">
                    <thead>
                      <tr>
                        <th>
                          <span className="userDatatable-title">Name</span>
                        </th>
                        <th>
                          <span>Created</span>
                        </th>
                        <th className="c-action">
                          <span className="float-right"></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedSizes.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <span className="position">{s.name}</span>
                          </td>
                          <td>
                            <span className="position">{formatDate(s.created_at)}</span>
                          </td>
                          <td>
                            <div className="table-actions d-flex">
                              {can('edit sizes') && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--edit"
                                  aria-label="Edit size"
                                  title="Edit"
                                  onClick={() => openEditModal(s)}
                                >
                                  <i className="la la-edit"></i>
                                </button>
                              )}
                              {can('delete sizes') && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--delete"
                                  aria-label="Delete size"
                                  title="Delete"
                                  onClick={() => openDeleteModal(s)}
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
                page={sizesPage}
                totalPages={sizesTotalPages}
                totalItems={sizesTotalItems}
                perPage={sizesPerPage}
                onPageChange={setSizesPage}
              />
            </div>
          </div>
        </div>
      </div>

      {modalMode && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">{modalMode === 'create' ? 'Add New Size' : 'Edit Size'}</h6>
                  <button type="button" className="btn-close" onClick={closeModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <form ref={formRef} onSubmit={handleSubmit} autoComplete="off" noValidate>
                    {formErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{formErrors[GENERAL_ERROR_KEY][0]}</p>}
                    <FloatingInput
                      label="Size (e.g. 600 x 1200)"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        clearError('name')
                      }}
                      autoFocus
                      error={formErrors.name?.[0]}
                    />
                    <div className="button-group d-flex justify-content-center pt-20">
                      <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded me-10" onClick={closeModal} disabled={submitting}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-sm btn-primary btn-rounded" disabled={submitting}>
                        {submitting ? 'Saving…' : modalMode === 'create' ? 'Add Size' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeModal}></div>
        </>
      )}

      {deleteTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Delete size?</h6>
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
                    This will permanently delete <strong>{deleteTarget.name}</strong>. This cannot be undone.
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
    </AppShell>
  )
}
