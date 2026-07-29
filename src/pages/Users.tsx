import { useEffect, useState, type FormEvent } from 'react'
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function extractErrors(error: unknown, fallback: string): Record<string, string[]> {
  if (error instanceof ApiError) {
    if (error.body?.errors) return error.body.errors
    return { [GENERAL_ERROR_KEY]: [error.body?.message ?? fallback] }
  }
  return { [GENERAL_ERROR_KEY]: [fallback] }
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

export default function Users() {
  const [users, setUsers] = useState<User[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

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

  return (
    <AppShell title="Users">
      <div className="hx-users-card card">
        <div className="card-body">
          <div className="hx-users-toolbar">
            <h5>All Users</h5>
            <button type="button" className="hx-btn hx-btn--primary" onClick={openCreateModal}>
              + Add User
            </button>
          </div>

          {loadError && <p className="hx-form-error">{loadError}</p>}

          {users === null && !loadError && <p className="hx-users-empty">Loading users…</p>}
          {users !== null && users.length === 0 && <p className="hx-users-empty">No users yet.</p>}

          {users !== null && users.length > 0 && (
            <div className="table-responsive">
              <table className="hx-users-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Created</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{formatDate(u.created_at)}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="hx-icon-btn"
                          onClick={() => openEditModal(u)}
                          aria-label={`Edit ${u.name}`}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="hx-icon-btn hx-icon-btn--danger"
                          onClick={() => {
                            setDeleteTarget(u)
                            setDeleteError(null)
                          }}
                          aria-label={`Delete ${u.name}`}
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalMode && (
        <div className="hx-modal-overlay" onClick={closeModal}>
          <div className="hx-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modalMode === 'create' ? 'Add User' : 'Edit User'}</h3>
            <form onSubmit={handleSubmit}>
              {formErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{formErrors[GENERAL_ERROR_KEY][0]}</p>}

              <label className="hx-field">
                <span>Name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
                {formErrors.name && <small className="hx-field-error">{formErrors.name[0]}</small>}
              </label>

              <label className="hx-field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
                {formErrors.email && <small className="hx-field-error">{formErrors.email[0]}</small>}
              </label>

              <label className="hx-field">
                <span>{modalMode === 'create' ? 'Password' : 'New Password (leave blank to keep current)'}</span>
                <div className="hx-password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    minLength={modalMode === 'create' ? 8 : undefined}
                    required={modalMode === 'create'}
                  />
                  <button type="button" className="hx-password-toggle" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {formErrors.password && <small className="hx-field-error">{formErrors.password[0]}</small>}
              </label>

              <div className="hx-modal-actions">
                <button type="button" className="hx-btn hx-btn--outline" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="hx-btn hx-btn--primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="hx-modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="hx-modal hx-modal--sm" onClick={(e) => e.stopPropagation()}>
            <h3>Delete user?</h3>
            <p>
              This will permanently delete <strong>{deleteTarget.name}</strong>. This cannot be undone.
            </p>
            {deleteError && <p className="hx-form-error">{deleteError}</p>}
            <div className="hx-modal-actions">
              <button
                type="button"
                className="hx-btn hx-btn--outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button type="button" className="hx-btn hx-btn--danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
