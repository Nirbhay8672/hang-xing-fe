import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import { FloatingInput } from '../components/FloatingField'
import '../components/formStyles.css'
import type { Profile } from '../profile/types'
import { profileService } from '../profile/profileService'
import './Profile.css'

interface ProfileFormState {
  name: string
  email: string
  currentPassword: string
  newPassword: string
}

const GENERAL_ERROR_KEY = '_general'

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

export default function ProfilePage() {
  const { updateUser } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm] = useState<ProfileFormState>({ name: '', email: '', currentPassword: '', newPassword: '' })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoadError(null)
    try {
      const data = await profileService.show()
      setProfile(data)
      setForm({ name: data.name, email: data.email, currentPassword: '', newPassword: '' })
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load profile.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormErrors({})
    setSuccessMessage(null)

    if (form.newPassword && !form.currentPassword) {
      setFormErrors({ current_password: ['Enter your current password to set a new one.'] })
      return
    }

    setSubmitting(true)
    try {
      const payload: { name: string; email: string; current_password?: string; password?: string } = {
        name: form.name,
        email: form.email,
      }
      if (form.newPassword) {
        payload.current_password = form.currentPassword
        payload.password = form.newPassword
      }
      const updated = await profileService.update(payload)
      setProfile(updated)
      setForm({ name: updated.name, email: updated.email, currentPassword: '', newPassword: '' })
      updateUser(updated)
      setSuccessMessage('Profile updated successfully.')
    } catch (err) {
      setFormErrors(extractErrors(err, 'Something went wrong. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell title="My Profile">
      <div className="row">
        <div className="col-12">
          {loadError && <p className="hx-form-error">{loadError}</p>}
          {profile === null && !loadError && <p className="hx-profile-loading">Loading profile…</p>}

          {profile && (
            <>
              <div className="card radius-xl mb-25">
                <div className="card-header px-sm-25 px-3">
                  <div className="edit-profile__title">
                    <h6>Roles &amp; Permissions</h6>
                  </div>
                </div>
                <div className="card-body">
                  <div className="hx-profile-section">
                    <span className="hx-profile-section__title">Roles</span>
                    {profile.roles.length > 0 ? (
                      <div className="hx-profile-badges">
                        {profile.roles.map((r) => (
                          <span key={r} className="hx-profile-badge">
                            {titleCase(r)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="hx-profile-empty-text">No roles assigned.</span>
                    )}
                  </div>
                  <div className="hx-profile-section">
                    <span className="hx-profile-section__title">Permissions</span>
                    {profile.permissions.length > 0 ? (
                      <div className="hx-profile-badges">
                        {profile.permissions.map((p) => (
                          <span key={p} className="hx-profile-badge">
                            {titleCase(p)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="hx-profile-empty-text">No permissions assigned.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="card radius-xl mb-25">
                <div className="card-header px-sm-25 px-3">
                  <div className="edit-profile__title">
                    <h6>Edit Profile</h6>
                  </div>
                </div>
                <div className="card-body">
                  <form onSubmit={handleSubmit} autoComplete="off">
                    {formErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{formErrors[GENERAL_ERROR_KEY][0]}</p>}
                    {successMessage && <p className="hx-form-success">{successMessage}</p>}

                    <div className="row">
                      <div className="col-md-6">
                        <FloatingInput
                          label="Name"
                          type="text"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          autoComplete="off"
                          required
                          error={formErrors.name?.[0]}
                        />
                      </div>
                      <div className="col-md-6">
                        <FloatingInput
                          label="Email Address"
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          autoComplete="off"
                          required
                          error={formErrors.email?.[0]}
                        />
                      </div>
                    </div>

                    <hr className="hx-profile-divider" />
                    <p className="hx-profile-section__title mb-20">Change Password (leave blank to keep current)</p>

                    <div className="row">
                      <div className="col-md-6">
                        <FloatingInput
                          label="Current Password"
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={form.currentPassword}
                          onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
                          autoComplete="current-password"
                          error={formErrors.current_password?.[0]}
                          endAdornment={
                            <button
                              type="button"
                              className="hx-password-toggle"
                              onClick={() => setShowCurrentPassword((v) => !v)}
                            >
                              <i className={`las ${showCurrentPassword ? 'la-eye-slash' : 'la-eye'}`}></i>
                            </button>
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <FloatingInput
                          label="New Password"
                          type={showNewPassword ? 'text' : 'password'}
                          value={form.newPassword}
                          onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                          minLength={8}
                          autoComplete="new-password"
                          error={formErrors.password?.[0]}
                          endAdornment={
                            <button
                              type="button"
                              className="hx-password-toggle"
                              onClick={() => setShowNewPassword((v) => !v)}
                            >
                              <i className={`las ${showNewPassword ? 'la-eye-slash' : 'la-eye'}`}></i>
                            </button>
                          }
                        />
                      </div>
                    </div>

                    <div className="button-group d-flex pt-10">
                      <button type="submit" className="btn btn-primary btn-default btn-squared" disabled={submitting}>
                        {submitting ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
