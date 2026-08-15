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

// Sidebar links whose target module requires a "view <module>" permission to be visible.
// Links with no entry here (e.g. Dashboard) are always shown.
const SIDEBAR_PERMISSIONS: Record<string, string> = {
  '/users': 'view users',
  '/roles': 'view roles',
  '/companies': 'view companies',
  '/orders': 'view orders',
}

// Users and Roles manage accounts/permissions for the whole app, so they're restricted to
// the Admin role in the sidebar on top of the permission check above, regardless of what
// permissions a non-admin role happens to be granted.
const SIDEBAR_ADMIN_ONLY = new Set(['/users', '/roles'])

function isAdmin(user: { roles: string[] }): boolean {
  return user.roles.some((role) => role.toLowerCase() === 'admin')
}

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
  // name/email, the active-link marking below) gets wiped back to placeholder content.
  // Watching the two containers and re-applying every fixup any time they change makes
  // this self-healing instead of a one-shot timing bet — the active-link marking used to
  // live in its own one-shot `[location.pathname]` effect, which lost the race against
  // this reset (it only fires once per navigation, before `assetsReady` flips the reset),
  // so the highlight silently vanished a few hundred ms after every page load.
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

      if (sidebar && user) {
        sidebar.querySelectorAll<HTMLAnchorElement>('.sidebar_nav a[href]').forEach((link) => {
          const href = link.getAttribute('href') ?? ''
          const entry = Object.entries(SIDEBAR_PERMISSIONS).find(([path]) => href.endsWith(path))
          if (!entry) return
          const li = link.closest('li')
          if (!li) return
          const [path, permission] = entry
          const allowed = user.permissions.includes(permission) && (!SIDEBAR_ADMIN_ONLY.has(path) || isAdmin(user))
          li.style.display = allowed ? '' : 'none'
        })
      }

      if (sidebar) {
        sidebar.querySelectorAll<HTMLAnchorElement>('.sidebar_nav a.active').forEach((el) => el.classList.remove('active'))
        sidebar.querySelectorAll<HTMLLIElement>('.sidebar_nav li.open').forEach((el) => el.classList.remove('open'))

        const activeLink = sidebar.querySelector<HTMLAnchorElement>(`a[href="${location.pathname}"]`)
        if (activeLink) {
          activeLink.classList.add('active')
          const parentLi = activeLink.closest('li.has-child')
          parentLi?.classList.add('open')
          parentLi?.querySelector<HTMLElement>(':scope > a')?.classList.add('active')
        }
      }

      syncing = false
    }

    const observer = new MutationObserver(resync)
    containers.forEach((el) => observer.observe(el, { childList: true, subtree: true }))
    resync()

    return () => observer.disconnect()
  }, [user, location.pathname])

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
