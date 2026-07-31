import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/apiClient'
import AppShell from '../components/AppShell'
import type { User } from '../users/types'
import { usersService } from '../users/usersService'
import './Users.css'

interface UserFormState {
  name: string
  email: string
  password: string
}

const EMPTY_FORM: UserFormState = { name: '', email: '', password: '' }
const GENERAL_ERROR_KEY = '_general'

// Theme demo avatars (public/html/img/tm*.png) — our API has no per-user photo,
// so each row gets a stable placeholder cycled by id.
const AVATARS = ['tm1', 'tm2', 'tm3', 'tm4', 'tm5', 'tm6', 'tm7', 'tm9', 'tm10', 'tm11', 'tm12', 'tm13', 'tm14']
function avatarFor(id: number): string {
  return `/html/img/${AVATARS[id % AVATARS.length]}.png`
}

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

export default function Users() {
  const [users, setUsers] = useState<User[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    if (openMenuId === null) return
    function handleOutsideClick(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest('.table-actions .dropdown')) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [openMenuId])

  async function loadUsers() {
    setLoadError(null)
    try {
      const data = await usersService.list()
      setUsers(data)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load users.')
    }
  }

  function openCreateModal() {
    setModalMode('create')
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setShowPassword(false)
  }

  function openEditModal(user: User) {
    setOpenMenuId(null)
    setModalMode('edit')
    setEditingUser(user)
    setForm({ name: user.name, email: user.email, password: '' })
    setFormErrors({})
    setShowPassword(false)
  }

  function closeModal() {
    if (submitting) return
    setModalMode(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormErrors({})
    try {
      if (modalMode === 'create') {
        const created = await usersService.create({
          name: form.name,
          email: form.email,
          password: form.password,
        })
        setUsers((prev) => (prev ? [created, ...prev] : [created]))
      } else if (modalMode === 'edit' && editingUser) {
        const payload: { name: string; email: string; password?: string } = {
          name: form.name,
          email: form.email,
        }
        if (form.password) payload.password = form.password
        const updated = await usersService.update(editingUser.id, payload)
        setUsers((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? null)
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
      await usersService.remove(deleteTarget.id)
      setUsers((prev) => prev?.filter((u) => u.id !== deleteTarget.id) ?? null)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete user.')
    } finally {
      setDeleting(false)
    }
  }

  const filteredUsers = users?.filter((u) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
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
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="action-btn">
        <button type="button" className="btn btn-sm btn-primary btn-add" onClick={openCreateModal}>
          <i className="la la-plus"></i> Add New
        </button>
      </div>
    </>
  )

  return (
    <AppShell title="Users" actions={headerActions}>
      <div className="row">
        <div className="col-12">
          <div className="contact-list-wrap mb-25">
            <div className="contact-list bg-white radius-xl w-100">
              {loadError && <p className="hx-form-error m-20">{loadError}</p>}
              {users === null && !loadError && <p className="hx-users-empty">Loading users…</p>}
              {filteredUsers && filteredUsers.length === 0 && <p className="hx-users-empty">No users found.</p>}

              {filteredUsers && filteredUsers.length > 0 && (
                <div className="table-responsive">
                  <table className="table mb-0 table-borderless table-rounded">
                    <thead>
                      <tr>
                        <th>
                          <div className="d-flex align-items-center">
                            <div className="custom-checkbox check-all">
                              <input className="checkbox" type="checkbox" id="check-all-users" />
                              <label htmlFor="check-all-users">
                                <span className="checkbox-text userDatatable-title">Name</span>
                              </label>
                            </div>
                          </div>
                        </th>
                        <th className="c-email">
                          <span>Email</span>
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
                      {filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div className="contact-item d-flex align-items-center">
                              <div className="contact-personal-wrap">
                                <div className="checkbox-group-wrapper">
                                  <div className="checkbox-group d-flex">
                                    <div className="checkbox-theme-default custom-checkbox checkbox-group__single d-flex">
                                      <input className="checkbox" type="checkbox" id={`check-user-${u.id}`} />
                                      <label htmlFor={`check-user-${u.id}`}></label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="contact-personal-info d-flex">
                                <span
                                  className="profile-image rounded-circle d-block m-0 wh-38"
                                  style={{ backgroundImage: `url('${avatarFor(u.id)}')`, backgroundSize: 'cover' }}
                                ></span>
                                <div className="contact_title">
                                  <h6>{u.name}</h6>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="email">{u.email}</span>
                          </td>
                          <td>
                            <span className="position">{formatDate(u.created_at)}</span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <div className={`dropdown dropdown-click${openMenuId === u.id ? ' show' : ''}`} ref={openMenuId === u.id ? menuRef : null}>
                                <button
                                  className="btn-link border-0 bg-transparent p-0"
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenMenuId((id) => (id === u.id ? null : u.id))
                                  }}
                                >
                                  <i className="las la-ellipsis-v"></i>
                                </button>
                                <div className={`dropdown-default dropdown-menu${openMenuId === u.id ? ' show' : ''}`}>
                                  <a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); openEditModal(u) }}>
                                    edit
                                  </a>
                                  <a
                                    className="dropdown-item"
                                    href="#"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      setOpenMenuId(null)
                                      setDeleteTarget(u)
                                      setDeleteError(null)
                                    }}
                                  >
                                    delete
                                  </a>
                                </div>
                              </div>
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
                  <h6 className="modal-title fw-500">{modalMode === 'create' ? 'Add New User' : 'Edit User'}</h6>
                  <button type="button" className="btn-close" onClick={closeModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="add-new-contact">
                    <form onSubmit={handleSubmit}>
                      {formErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{formErrors[GENERAL_ERROR_KEY][0]}</p>}

                      <div className="form-group mb-20">
                        <label>Name:</label>
                        <input
                          type="text"
                          className="form-control form-control-lg"
                          placeholder="Full name"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          required
                        />
                        {formErrors.name && <small className="hx-field-error">{formErrors.name[0]}</small>}
                      </div>

                      <div className="form-group mb-20">
                        <label>Email Address:</label>
                        <input
                          type="email"
                          className="form-control form-control-lg"
                          placeholder="Email address"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          required
                        />
                        {formErrors.email && <small className="hx-field-error">{formErrors.email[0]}</small>}
                      </div>

                      <div className="form-group mb-20">
                        <label>{modalMode === 'create' ? 'Password:' : 'New Password (leave blank to keep current):'}</label>
                        <div className="hx-password-field">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            className="form-control form-control-lg"
                            placeholder={modalMode === 'create' ? 'Password' : 'New password'}
                            value={form.password}
                            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                            minLength={modalMode === 'create' ? 8 : undefined}
                            required={modalMode === 'create'}
                          />
                          <button type="button" className="hx-password-toggle" onClick={() => setShowPassword((v) => !v)}>
                            <i className={`las ${showPassword ? 'la-eye-slash' : 'la-eye'}`}></i>
                          </button>
                        </div>
                        {formErrors.password && <small className="hx-field-error">{formErrors.password[0]}</small>}
                      </div>

                      <div className="button-group d-flex pt-20">
                        <button type="button" className="btn btn-outline-secondary btn-squared me-10" onClick={closeModal} disabled={submitting}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-default btn-squared" disabled={submitting}>
                          {submitting ? 'Saving…' : modalMode === 'create' ? 'Add New User' : 'Save Changes'}
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

      {deleteTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Delete user?</h6>
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
                  <div className="button-group d-flex pt-20">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-squared me-10"
                      onClick={() => setDeleteTarget(null)}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button type="button" className="btn btn-danger btn-squared" onClick={handleDelete} disabled={deleting}>
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
