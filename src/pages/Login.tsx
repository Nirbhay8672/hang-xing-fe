import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import { FloatingInput } from '../components/FloatingField'
import '../components/formStyles.css'
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

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <path fill="#fbbb00" d="M4.432 144.953l-.7 2.6-2.544.054a10.017 10.017 0 0 1-.074-9.338h0l2.265.415.992 2.252a5.968 5.968 0 0 0 .056 4.018Z" transform="translate(0 -132.867)" />
      <path fill="#518ef8" d="M271.233 208.176a10 10 0 0 1-3.565 9.666h0l-2.853-.146-.4-2.521a5.96 5.96 0 0 0 2.564-3.043h-5.347v-3.956h9.605Z" transform="translate(-251.408 -200.044)" />
      <path fill="#28b446" d="M45.577 315.121h0a10 10 0 0 1-15.069-3.059l3.241-2.653a5.947 5.947 0 0 0 8.57 3.045Z" transform="translate(-29.317 -297.323)" />
      <path fill="#f14336" d="M43.889 2.3l-3.24 2.652a5.947 5.947 0 0 0-8.767 3.114L28.625 5.4h0A10 10 0 0 1 43.889 2.3Z" transform="translate(-27.506)" />
    </svg>
  )
}

function ApertureIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="14.31" y1="8" x2="20.05" y2="17.94" />
      <line x1="9.69" y1="8" x2="21.17" y2="8" />
      <line x1="7.38" y1="12" x2="13.12" y2="2.06" />
      <line x1="9.69" y1="16" x2="3.95" y2="6.06" />
      <line x1="14.31" y1="16" x2="2.83" y2="16" />
      <line x1="16.62" y1="12" x2="10.88" y2="21.94" />
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
            <h1>Sign in</h1>
            <p className="login-subtitle">Heng Xing Pvt. Ltd.</p>

            <form onSubmit={handleSubmit}>
              {error && <p className="form-error">{error}</p>}

              <FloatingInput
                label="Email"
                type="email"
                variant="bare"
                wrapperClassName="form-field"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <FloatingInput
                label="Password"
                type={showPassword ? 'text' : 'password'}
                variant="bare"
                wrapperClassName="form-field form-field--password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                endAdornment={
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                }
              />

              <button type="submit" className="btn-signin" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="login-divider">
              <span>Or continue with</span>
            </div>

            <div className="social-row">
              <button type="button" className="social-btn" aria-label="Continue with Google">
                <GoogleIcon />
              </button>
            </div>
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

      <button type="button" className="login-page__fab" aria-label="Settings">
        <ApertureIcon />
      </button>
    </main>
  )
}
