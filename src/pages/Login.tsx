import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import './Login.css'

const SLIDESHOW_IMAGES = ['images/product/product.jpg', 'images/product/product1.jpg'].map(
  (path) => `${import.meta.env.BASE_URL}${path}`,
)
const SLIDESHOW_INTERVAL_MS = 4000

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const firstValidationError = error.body?.errors && Object.values(error.body.errors)[0]?.[0]
    return firstValidationError ?? error.body?.message ?? 'Invalid email or password.'
  }
  return 'Something went wrong. Please try again.'
}

export default function Login() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setActiveSlide((i) => (i + 1) % SLIDESHOW_IMAGES.length)
    }, SLIDESHOW_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      const from = (location.state as { from?: Location })?.from
      navigate(from?.pathname ?? '/', { replace: true })
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-card__form">
          <div className="login-card__form-inner">
            <img className="login-logo" src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Heng Xing" />

            <form onSubmit={handleSubmit}>
              {error && <p className="form-error">{error}</p>}

              <div className="form-field">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-field form-field--password">
                <label htmlFor="login-password">Password</label>
                <div className="password-input">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-signin" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        <div className="login-card__media">
          {SLIDESHOW_IMAGES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              className={`login-card__media-slide${i === activeSlide ? ' is-active' : ''}`}
            />
          ))}
          <div className="login-card__media-overlay">
            <div className="login-card__media-caption">
              <p>Finally, all your work in one place.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
