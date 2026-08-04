import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { DASHBOARD_JS_SRCS } from '../pages/dashboardAssets'
import PageLoader from './PageLoader'
import { SHELL_HEADER_HTML, SHELL_SIDEBAR_HTML } from './shellMarkup'

declare global {
  interface Window {
    /** Global injected by the vendored feather.min.js (see DASHBOARD_JS_SRCS). */
    feather?: { replace: () => void }
  }
}

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
      if (cancelled) return
      window.feather?.replace()
      setAssetsReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Keeps the header/sidebar content in sync no matter what else touches that DOM. React
  // itself re-applies the raw `dangerouslySetInnerHTML` markup once shortly after mount
  // (a re-render of this component resets it back to the pristine template), and a few of
  // the vendored jQuery plugins do their own async DOM rebuilding on top of that — either
  // way, anything imperatively patched in (feather's SVG swap, the logged-in user's
  // name/email) gets wiped back to placeholder content. Watching the two containers and
  // re-applying both fixups any time they change makes this self-healing instead of a
  // one-shot timing bet.
  useEffect(() => {
    const header = headerRef.current
    const sidebar = sidebarRef.current
    const containers = [header, sidebar].filter((el): el is HTMLDivElement => el !== null)
    if (containers.length === 0) return

    let syncing = false
    function resync() {
      if (syncing) return
      syncing = true

      if (document.querySelectorAll('[data-feather]').length > 0) {
        window.feather?.replace()
      }

      if (header && user) {
        const nameEl = header.querySelector<HTMLElement>('.nav-author__info h6')
        const emailEl = header.querySelector<HTMLElement>('.nav-author__info span')
        if (nameEl && nameEl.textContent !== user.name) nameEl.textContent = user.name
        if (emailEl && emailEl.textContent !== user.email) emailEl.textContent = user.email
      }

      syncing = false
    }

    const observer = new MutationObserver(resync)
    containers.forEach((el) => observer.observe(el, { childList: true, subtree: true }))
    resync()

    return () => observer.disconnect()
  }, [user])

  // Sign-out and the sidebar-collapse toggle both live inside the header's raw HTML, so a
  // listener attached directly to those inner elements (or main.js's own vendored wiring
  // for the toggle) gets lost whenever that markup is rebuilt (see the effect above).
  // Delegating from the stable outer container instead means the listener survives no
  // matter how many times its descendants get replaced.
  useEffect(() => {
    const header = headerRef.current
    if (!header) return

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement

      if (target.closest('.nav-author__signout')) {
        event.preventDefault()
        logout().finally(() => navigate('/login', { replace: true }))
        return
      }

      if (target.closest('.sidebar-toggle')) {
        event.preventDefault()
        document.querySelector('.overlay-dark-sidebar')?.classList.toggle('show')
        document.querySelector('.sidebar')?.classList.toggle('sidebar-collapse')
        document.querySelector('.sidebar')?.classList.toggle('collapsed')
        document.querySelector('.contents')?.classList.toggle('expanded')
      }
    }

    header.addEventListener('click', handleClick)
    return () => header.removeEventListener('click', handleClick)
  }, [logout, navigate])

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
                  <p>© 2026 Heng Xing Pvt. Ltd. All Right Reserved.</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="footer-copyright text-end">
                  <p>
                    Made with <span className="text-danger">&#10084;</span> in India by <a href="#">Mr. Web</a>.
                  </p>
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
