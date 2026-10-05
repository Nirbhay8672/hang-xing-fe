import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAdmin, isMarketing } from '../auth/roleUtils'
import { DASHBOARD_JS_SRCS } from '../pages/dashboardAssets'
import NotificationBell from './NotificationBell'
import './shell.css'
import './pageTheme.css'
import { SHELL_HEADER_HTML, SHELL_SIDEBAR_HTML } from './shellMarkup'

declare global {
  interface Window {
    /** Global injected by the vendored feather.min.js (see DASHBOARD_JS_SRCS). */
    feather?: { replace: () => void }
    /** Global injected by the vendored jQuery (see DASHBOARD_JS_SRCS). */
    jQuery?: (target: unknown) => { trigger: (event: string) => void }
  }
}

let dashboardAssets: Promise<void> | null = null

/**
 * Injects the theme's vendor scripts once per page load and resolves when the last one has
 * loaded. The shell (header + sidebar) is a persistent layout route (ShellLayout below), so it
 * stays mounted while the user moves between pages — the scripts never need re-running for a
 * navigation. If the shell does remount (sign out, then back in), ShellLayout re-applies the
 * scripts' DOM fixups itself (feather icons, main.js's resize-driven sidebar/header wiring)
 * instead of re-downloading and re-executing all ~46 of them.
 */
function loadDashboardAssets(): Promise<void> {
  dashboardAssets ??= new Promise((resolve) => {
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
  return dashboardAssets
}

/** The app's own path for an in-app link's href (BASE_URL stripped), or null for anything else. */
function appPath(href: string | null): string | null {
  if (!href || href.startsWith('#') || /^[a-z]+:/i.test(href) || href.startsWith('//')) return null
  const base = import.meta.env.BASE_URL
  if (href.startsWith(`${base}html/`)) return null // the theme's static demo pages
  const path = href.startsWith(base) ? `/${href.slice(base.length)}` : href
  return path.startsWith('/') ? path : null
}

/** Below 1150px the sidebar is off-canvas — close it (and its backdrop) after navigating. */
function closeOffCanvasSidebar() {
  if (window.innerWidth > 1150) return
  document.querySelector('.overlay-dark-sidebar')?.classList.remove('show')
  const sidebar = document.querySelector('.sidebar')
  sidebar?.classList.remove('sidebar-collapse')
  sidebar?.classList.add('collapsed')
}

// React re-applies `dangerouslySetInnerHTML` (rebuilding that DOM) on every render whenever the
// prop is a new object, even with identical HTML. Keeping these two objects stable means
// re-renders leave the header/sidebar DOM alone — which matters now that a React component (the
// notification bell) is portalled into the header: a rebuild would destroy its mount point, and
// re-finding it re-renders AppShell, which would rebuild the header again, forever.
const HEADER_INNER_HTML = { __html: SHELL_HEADER_HTML }
const SIDEBAR_INNER_HTML = { __html: SHELL_SIDEBAR_HTML }

// Sidebar links and the permission each needs to be visible — which permissions a person has
// comes from their role (Admin: everything; Marketing: companies/orders/complaints/problems;
// Planning: Planning; Production: Production). Links with no entry here are always shown.
// Users/Roles/Sizes (and Problems, for Admin) are reached through the Settings tile grid (pages/Settings.tsx).
const SIDEBAR_PERMISSIONS: Record<string, string> = {
  '/companies': 'view companies',
  '/orders': 'view orders',
  '/planning': 'access planning',
  '/production': 'access production',
  '/complaints': 'view complaints',
  '/problems': 'view problems',
}

// Complaints is Marketing's day-to-day tool (customer-raised issues), so it's restricted to
// the Marketing and Admin roles in the sidebar on top of the permission check above,
// regardless of what permissions a non-admin role happens to be granted.
const SIDEBAR_ADMIN_ONLY = new Set<string>([])

// Marketing works with Problems every day so it gets its own sidebar link; Admin reaches the
// same page from the Settings tiles instead, so the link is hidden for Admin.
const SIDEBAR_HIDDEN_FOR_ADMIN = new Set(['/problems'])

// Links shown when the user holds ANY of these permissions.
const SIDEBAR_ANY_PERMISSION: Record<string, string[]> = {
  // The dashboard overview and the requests inbox are Admin's; everyone else only sees their own modules
  // (people who raise delete requests follow them from the header bell).
  '/': ['view users'],
  '/delete-requests': ['review delete requests'],
  '/settings': ['view users', 'view roles', 'view sizes'],
}
const SIDEBAR_MARKETING_OR_ADMIN = new Set(['/complaints'])

interface AppShellProps {
  title: string
  /** Rendered inside the shared header's .breadcrumb-action slot (search box, "Add New", etc). */
  actions?: ReactNode
  children: ReactNode
}

/**
 * A page's title row (title + optional toolbar) and content. Rendered by each page inside the
 * persistent ShellLayout, so switching pages only swaps this part — the header and sidebar
 * stay put, like any single-page app.
 */
export default function AppShell({ title, actions, children }: AppShellProps) {
  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="breadcrumb-main">
            <h4 className="text-capitalize breadcrumb-title">{title}</h4>
            {actions && <div className="breadcrumb-action justify-content-center flex-wrap">{actions}</div>}
          </div>
        </div>
      </div>

      {children}
    </>
  )
}

/**
 * The app frame — header, sidebar, footer — mounted once as the layout route for every
 * signed-in page; the current page renders into its <Outlet />.
 */
export function ShellLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const headerRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  // The header's bell is a React component portalled into a placeholder inside the raw header
  // markup; the placeholder is re-found whenever that markup gets rebuilt (see resync below).
  const [notifRoot, setNotifRoot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const alreadyLoaded = dashboardAssets !== null
    loadDashboardAssets().then(() => {
      if (cancelled) return
      window.feather?.replace()
      // On a remount the scripts' one-time setup ran against the previous shell DOM; replaying
      // a resize re-runs main.js's responsive wiring (sidebar collapse, header menu placement).
      if (alreadyLoaded) window.jQuery?.(window).trigger('resize')
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Each new page starts at the top, as a fresh page load would.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Sidebar links are plain anchors in the theme's raw markup — route them in-app instead of
  // letting the browser reload the whole page. Delegated from the stable container so it
  // survives that markup being rebuilt. Ctrl/Cmd/Shift/middle-click still open a new tab.
  useEffect(() => {
    const sidebar = sidebarRef.current
    if (!sidebar) return

    function handleClick(event: MouseEvent) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      const link = (event.target as HTMLElement).closest('a')
      const path = appPath(link?.getAttribute('href') ?? null)
      if (!path) return
      event.preventDefault()
      closeOffCanvasSidebar()
      navigate(path)
    }

    sidebar.addEventListener('click', handleClick)
    return () => sidebar.removeEventListener('click', handleClick)
  }, [navigate])

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

      if (header) {
        const bellRoot = header.querySelector<HTMLElement>('#hx-notification-root')
        setNotifRoot((prev) => (prev === bellRoot ? prev : bellRoot))
      }

      if (sidebar && user) {
        sidebar.querySelectorAll<HTMLAnchorElement>('.sidebar_nav a[href]').forEach((link) => {
          const href = link.getAttribute('href') ?? ''
          const anyEntry = Object.entries(SIDEBAR_ANY_PERMISSION).find(([path]) => href.endsWith(path))
          if (anyEntry) {
            const anyLi = link.closest('li')
            if (anyLi) anyLi.style.display = anyEntry[1].some((permission) => user.permissions.includes(permission)) ? '' : 'none'
            return
          }
          const entry = Object.entries(SIDEBAR_PERMISSIONS).find(([path]) => href.endsWith(path))
          if (!entry) return
          const li = link.closest('li')
          if (!li) return
          const [path, permission] = entry
          const allowed =
            user.permissions.includes(permission) &&
            (!SIDEBAR_ADMIN_ONLY.has(path) || isAdmin(user)) &&
            (!SIDEBAR_HIDDEN_FOR_ADMIN.has(path) || !isAdmin(user)) &&
            (!SIDEBAR_MARKETING_OR_ADMIN.has(path) || isAdmin(user) || isMarketing(user))
          li.style.display = allowed ? '' : 'none'
        })
      }

      if (sidebar) {
        sidebar.querySelectorAll<HTMLAnchorElement>('.sidebar_nav a.active').forEach((el) => el.classList.remove('active'))
        sidebar.querySelectorAll<HTMLLIElement>('.sidebar_nav li.open').forEach((el) => el.classList.remove('open'))

        const activeLink = [...sidebar.querySelectorAll<HTMLAnchorElement>('.sidebar_nav a[href]')].find(
          (link) => appPath(link.getAttribute('href')) === location.pathname,
        )
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

      // Logo → home. Its href is "/" (so new-tab / middle-click still work); a plain click is
      // routed in-app instead of reloading the whole page.
      if (target.closest('.navbar-brand') && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault()
        closeOffCanvasSidebar()
        navigate('/')
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
      <div ref={headerRef} dangerouslySetInnerHTML={HEADER_INNER_HTML} />
      {notifRoot && createPortal(<NotificationBell />, notifRoot)}

      <main className="main-content">
        <div ref={sidebarRef} dangerouslySetInnerHTML={SIDEBAR_INNER_HTML} />

        <div className="contents">
          {/* Keyed by path so each page's entrance animation (pageTheme.css) replays on navigation. */}
          <div className="container-fluid" key={location.pathname}>
            <Outlet />
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
