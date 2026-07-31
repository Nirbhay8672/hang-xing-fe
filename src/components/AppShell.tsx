import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { DASHBOARD_JS_SRCS } from '../pages/dashboardAssets'
import PageLoader from './PageLoader'
import { SHELL_HEADER_HTML, SHELL_SIDEBAR_HTML } from './shellMarkup'

/**
 * Re-injects the theme's vendor scripts and resolves once the last one has loaded.
 *
 * These scripts don't just define reusable libraries — several of them (charts.js,
 * main.js's feather-icon/inline-SVG swap, etc.) wire themselves up to whatever specific
 * DOM elements exist *at the moment they execute*. AppShell mounts fresh on every route
 * change (Dashboard <-> Users are different component trees, so React fully unmounts and
 * remounts it), so if these scripts only ran once, icons would only ever render on the
 * very first mount and stay blank after that. Re-running them fresh each time keeps them
 * in sync; old script tags from a previous mount are removed first so they don't pile up.
 */
function injectDashboardAssets(): Promise<void> {
  document.querySelectorAll('script[data-dashboard-asset]').forEach((el) => el.remove())

  return new Promise((resolve) => {
    DASHBOARD_JS_SRCS.forEach((src, index) => {
      const script = document.createElement('script')
      script.src = src
      // Preserves the theme's original load order (jQuery before its plugins, etc.).
      script.async = false
      script.dataset.dashboardAsset = 'true'
      if (index === DASHBOARD_JS_SRCS.length - 1) {
        script.addEventListener('load', () => resolve())
        script.addEventListener('error', () => resolve())
      }
      document.body.appendChild(script)
    })
  })
}

// Re-fetching these ~46 scripts is near-instant once the browser has them cached, which
// can make the loader flash so briefly it reads as "not showing" at all. Holding it up
// for at least this long keeps it perceptible without meaningfully delaying real loads.
const MIN_LOADER_MS = 500
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface AppShellProps {
  title: string
  /** Rendered inside the shared header's .breadcrumb-action slot (search box, "Add New", etc). */
  actions?: ReactNode
  children: ReactNode
}

export default function AppShell({ title, actions, children }: AppShellProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [assetsReady, setAssetsReady] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([injectDashboardAssets(), delay(MIN_LOADER_MS)]).then(() => {
      if (!cancelled) setAssetsReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // The header markup below is the theme's raw HTML (dangerouslySetInnerHTML), so the
  // logged-in user's name/email and the real sign-out action are patched onto it here,
  // the same way the pre-React template would if it were driven by a backend templating
  // language instead of React.
  useEffect(() => {
    const header = headerRef.current
    if (!header) return

    const nameEl = header.querySelector<HTMLElement>('.nav-author__info h6')
    const emailEl = header.querySelector<HTMLElement>('.nav-author__info span')
    if (nameEl && user) nameEl.textContent = user.name
    if (emailEl && user) emailEl.textContent = user.email

    const signOutEl = header.querySelector<HTMLAnchorElement>('.nav-author__signout')
    if (!signOutEl) return

    function handleSignOut(event: MouseEvent) {
      event.preventDefault()
      logout().finally(() => navigate('/login', { replace: true }))
    }
    signOutEl.addEventListener('click', handleSignOut)
    return () => signOutEl.removeEventListener('click', handleSignOut)
  }, [user, logout, navigate])

  // Marks whichever sidebar link matches the current route as active/open, mirroring how
  // the theme's own static pages ship each with their own nav item pre-marked active.
  useEffect(() => {
    const sidebar = sidebarRef.current
    if (!sidebar) return

    const activeLink = sidebar.querySelector<HTMLAnchorElement>(`a[href="${location.pathname}"]`)
    if (!activeLink) return

    activeLink.classList.add('active')
    const parentLi = activeLink.closest('li.has-child')
    const toggle = parentLi?.querySelector<HTMLElement>(':scope > a')
    parentLi?.classList.add('open')
    toggle?.classList.add('active')

    return () => {
      activeLink.classList.remove('active')
      parentLi?.classList.remove('open')
      toggle?.classList.remove('active')
    }
  }, [location.pathname])

  return (
    <>
      {!assetsReady && <PageLoader />}

      <div ref={headerRef} dangerouslySetInnerHTML={{ __html: SHELL_HEADER_HTML }} />

      <main className="main-content">
        <div ref={sidebarRef} dangerouslySetInnerHTML={{ __html: SHELL_SIDEBAR_HTML }} />

        <div className="contents">
          <div className="container-fluid">
            <div className="row">
              <div className="col-lg-12">
                <div className="breadcrumb-main">
                  <h4 className="text-capitalize breadcrumb-title">{title}</h4>
                  {actions && <div className="breadcrumb-action justify-content-center flex-wrap">{actions}</div>}
                </div>
              </div>
            </div>

            {children}
          </div>
        </div>

        <footer className="footer-wrapper">
          <div className="container-fluid">
            <div className="row">
              <div className="col-md-6">
                <div className="footer-copyright">
                  <p>
                    2020 @<a href="#">Aazztech</a>
                  </p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="footer-menu text-end">
                  <ul>
                    <li>
                      <a href="#">About</a>
                    </li>
                    <li>
                      <a href="#">Team</a>
                    </li>
                    <li>
                      <a href="#">Contact</a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>

      <div className="overlay-dark-sidebar"></div>
    </>
  )
}
