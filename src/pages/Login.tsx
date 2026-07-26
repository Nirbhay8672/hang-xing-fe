import { useEffect, useState, type FormEvent } from 'react'
import './Login.css'

const SLIDESHOW_IMAGES = ['/images/product/product.jpg', '/images/product/product1.jpg']
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

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1a1620">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.011 1.454 2.208 3.09 3.792 3.03 1.52-.06 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.679-2.941 1.156-1.688 1.636-3.325 1.662-3.41-.036-.017-3.19-1.226-3.222-4.861-.026-3.037 2.48-4.494 2.59-4.564-1.423-2.09-3.632-2.324-4.41-2.376-2.006-.16-3.687 1.098-4.584 1.098zm3.11-2.85c.837-1.012 1.4-2.422 1.246-3.822-1.207.049-2.665.804-3.53 1.816-.775.9-1.454 2.336-1.27 3.71 1.339.104 2.712-.68 3.554-1.704z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20">
      <path fill="#475993" d="M17.307 0H2.7A2.7 2.7 0 0 0 0 2.7v14.61A2.7 2.7 0 0 0 2.7 20H9.9l.012-7.147H8.058a.438.438 0 0 1-.438-.436l-.009-2.3a.438.438 0 0 1 .438-.44H9.9V7.447a3.637 3.637 0 0 1 3.882-3.99h1.891a.438.438 0 0 1 .438.438V5.838a.438.438 0 0 1-.438.438h-1.16c-1.253 0-1.5.6-1.5 1.469V9.673h2.754a.438.438 0 0 1 .435.49l-.273 2.3a.438.438 0 0 1-.435.387H13.032L13.02 20h4.287a2.7 2.7 0 0 0 2.7-2.7V2.7A2.7 2.7 0 0 0 17.307 0Z" />
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

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setActiveSlide((i) => (i + 1) % SLIDESHOW_IMAGES.length)
    }, SLIDESHOW_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    // The dashboard theme's style.css paints a full-screen white body::after overlay
    // that's only hidden once <body> has a "loaded" class (normally added by the
    // theme's own loader.js, which this page doesn't load).
    document.body.classList.add('loaded')
    return () => {
      document.body.classList.remove('loaded')
    }
  }, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-card__form">
          <div className="login-card__form-inner">
            <img className="login-logo" src="/images/logo.png" alt="Heng Xing" />
            <h1>Sign in</h1>
            <p className="login-subtitle">Heng Xing Pvt. Ltd.</p>

            <form onSubmit={handleSubmit}>
              <div className="form-field">
                <input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-field form-field--password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

              <button type="submit" className="btn-signin">
                Sign In
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
