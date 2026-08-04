import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import { FloatingInput } from '../components/FloatingField'
import '../components/detailView.css'
import '../components/formStyles.css'
import '../components/iconButtons.css'
import type { PermissionGroup } from '../permissions/types'
import { permissionsService } from '../permissions/permissionsService'
import type { Role } from '../roles/types'
import { rolesService } from '../roles/rolesService'
import './Roles.css'

interface RoleFormState {
  name: string
  permissions: string[]
}

const EMPTY_FORM: RoleFormState = { name: '', permissions: [] }
const GENERAL_ERROR_KEY = '_general'
const PERMISSIONS_PREVIEW_LIMIT = 3

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase())
}

function extractErrors(error: unknown, fallback: string): Record<string, string[]> {
  if (error instanceof ApiError) {
    if (error.body?.errors) return error.body.errors
    return { [GENERAL_ERROR_KEY]: [error.body?.message ?? fallback] }
  }
  return { [GENERAL_ERROR_KEY]: [fallback] }
}

export default function Roles() {
  const { can } = useAuth()
  const [roles, setRoles] = useState<Role[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[] | null>(null)
  const [permissionsError, setPermissionsError] = useState<string | null>(null)

  const [viewTarget, setViewTarget] = useState<Role | null>(null)

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [form, setForm] = useState<RoleFormState>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadRoles()
    loadPermissions()
  }, [])

  async function loadRoles() {
    setLoadError(null)
    try {
      const data = await rolesService.list()
      setRoles(data)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load roles.')
    }
  }

  async function loadPermissions() {
    setPermissionsError(null)
    try {
      const data = await permissionsService.list()
      setPermissionGroups(data)
    } catch (err) {
      setPermissionsError(err instanceof ApiError ? err.message : 'Failed to load permissions.')
    }
  }

  function openCreateModal() {
    setModalMode('create')
    setEditingRole(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
  }

  function openViewModal(role: Role) {
    setViewTarget(role)
  }

  function openEditModal(role: Role) {
    setModalMode('edit')
    setEditingRole(role)
    setForm({ name: role.name, permissions: [...role.permissions] })
    setFormErrors({})
  }

  function closeModal() {
    if (submitting) return
    setModalMode(null)
  }

  function togglePermission(name: string) {
    setForm((f) =>
      f.permissions.includes(name)
        ? { ...f, permissions: f.permissions.filter((p) => p !== name) }
        : { ...f, permissions: [...f.permissions, name] },
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormErrors({})
    try {
      const payload = { name: form.name, permissions: form.permissions }
      if (modalMode === 'create') {
        const created = await rolesService.create(payload)
        setRoles((prev) => (prev ? [created, ...prev] : [created]))
      } else if (modalMode === 'edit' && editingRole) {
        const updated = await rolesService.update(editingRole.id, payload)
        setRoles((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? null)
      }
      setModalMode(null)
    } catch (err) {
      setFormErrors(extractErrors(err, 'Something went wrong. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await rolesService.remove(deleteTarget.id)
      setRoles((prev) => prev?.filter((r) => r.id !== deleteTarget.id) ?? null)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete role.')
    } finally {
      setDeleting(false)
    }
  }

  function openDeleteModal(role: Role) {
    setDeleteTarget(role)
    setDeleteError(null)
  }

  const filteredRoles = roles?.filter((r) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return r.name.toLowerCase().includes(q) || r.permissions.some((p) => p.toLowerCase().includes(q))
  })

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
              placeholder="Search by name or permission"
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
    <AppShell title="Roles" actions={headerActions}>
      <div className="row">
        <div className="col-12">
          <div className="contact-list-wrap mb-25">
            <div className="contact-list bg-white radius-xl w-100">
              {loadError && <p className="hx-form-error m-20">{loadError}</p>}
              {roles === null && !loadError && <p className="hx-roles-empty">Loading roles…</p>}
              {filteredRoles && filteredRoles.length === 0 && <p className="hx-roles-empty">No roles found.</p>}

              {filteredRoles && filteredRoles.length > 0 && (
                <div className="table-responsive">
                  <table className="table mb-0 table-borderless table-rounded">
                    <thead>
                      <tr>
                        <th>
                          <span className="userDatatable-title">Name</span>
                        </th>
                        <th className="c-email">
                          <span>Permissions</span>
                        </th>
                        <th className="c-position">
                          <span>Created</span>
                        </th>
                        <th className="c-action">
                          <span className="float-right"></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRoles.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <span className="position">{r.name}</span>
                          </td>
                          <td>
                            {r.permissions.length > 0 ? (
                              <div className="hx-role-badges">
                                {r.permissions.slice(0, PERMISSIONS_PREVIEW_LIMIT).map((p) => (
                                  <span key={p} className="hx-role-badge">
                                    {p}
                                  </span>
                                ))}
                                {r.permissions.length > PERMISSIONS_PREVIEW_LIMIT && (
                                  <span className="hx-role-badge hx-role-badge--more">
                                    +{r.permissions.length - PERMISSIONS_PREVIEW_LIMIT} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="position">No permissions</span>
                            )}
                          </td>
                          <td>
                            <span className="position">{formatDate(r.created_at)}</span>
                          </td>
                          <td>
                            <div className="table-actions d-flex">
                              <button
                                type="button"
                                className="hx-icon-btn hx-icon-btn--view"
                                aria-label="View role"
                                title="View"
                                onClick={() => openViewModal(r)}
                              >
                                <i className="la la-eye"></i>
                              </button>
                              {can('edit roles') && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--edit"
                                  aria-label="Edit role"
                                  title="Edit"
                                  onClick={() => openEditModal(r)}
                                >
                                  <i className="la la-edit"></i>
                                </button>
                              )}
                              {can('delete roles') && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--delete"
                                  aria-label="Delete role"
                                  title="Delete"
                                  onClick={() => openDeleteModal(r)}
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
                  <h6 className="modal-title fw-500">{modalMode === 'create' ? 'Add New Role' : 'Edit Role'}</h6>
                  <button type="button" className="btn-close" onClick={closeModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="add-new-contact">
                    <form onSubmit={handleSubmit} autoComplete="off">
                      {formErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{formErrors[GENERAL_ERROR_KEY][0]}</p>}

                      <FloatingInput
                        label="Name"
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        autoComplete="off"
                        required
                        error={formErrors.name?.[0]}
                      />

                      <div className="form-group mb-20">
                        <label>Permissions:</label>
                        {permissionsError && <p className="hx-form-error">{permissionsError}</p>}
                        {permissionGroups === null && !permissionsError && (
                          <p className="hx-roles-empty">Loading permissions…</p>
                        )}
                        {permissionGroups && permissionGroups.length === 0 && (
                          <p className="hx-roles-empty">No permissions available.</p>
                        )}
                        {permissionGroups && permissionGroups.length > 0 && (
                          <div className="hx-permission-groups">
                            {permissionGroups.map((group) => (
                              <div key={group.module} className="hx-permission-group">
                                <span className="hx-permission-group__title">{titleCase(group.module)}</span>
                                <div className="hx-permission-grid">
                                  {group.permissions.map((p) => (
                                    <label key={p.id} className="hx-permission-checkbox">
                                      <input
                                        type="checkbox"
                                        checked={form.permissions.includes(p.name)}
                                        onChange={() => togglePermission(p.name)}
                                      />
                                      <span>{titleCase(p.name)}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {formErrors.permissions && <small className="hx-field-error">{formErrors.permissions[0]}</small>}
                      </div>

                      <div className="button-group d-flex justify-content-center pt-20">
                        <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded me-10" onClick={closeModal} disabled={submitting}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-sm btn-primary btn-rounded" disabled={submitting}>
                          {submitting ? 'Saving…' : modalMode === 'create' ? 'Add New Role' : 'Save Changes'}
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

      {viewTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Role Details</h6>
                  <button type="button" className="btn-close" onClick={() => setViewTarget(null)} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Role</span>
                    <div className="hx-detail-grid">
                      <div>
                        <span className="hx-detail-grid__label">Name</span>
                        <span className="hx-detail-grid__value">{viewTarget.name}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Created</span>
                        <span className="hx-detail-grid__value">{formatDate(viewTarget.created_at)}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Last Updated</span>
                        <span className="hx-detail-grid__value">{formatDate(viewTarget.updated_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Permissions</span>
                    {viewTarget.permissions.length > 0 ? (
                      <div className="hx-role-badges">
                        {viewTarget.permissions.map((p) => (
                          <span key={p} className="hx-role-badge">
                            {titleCase(p)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="hx-roles-empty">No permissions assigned.</span>
                    )}
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
                  <h6 className="modal-title fw-500">Delete role?</h6>
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
