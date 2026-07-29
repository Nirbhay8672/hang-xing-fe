import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import PageLoader from '../components/PageLoader'
import DASHBOARD_HTML from './dashboardContent'
import { DASHBOARD_JS_SRCS } from './dashboardAssets'
import './Dashboard.css'

/**
 * Re-injects the theme's vendor scripts and resolves once the last one has loaded.
 *
 * These scripts don't just define reusable libraries — several of them (charts.js,
 * main.js's feather-icon/inline-SVG swap, etc.) wire themselves up to whatever specific
 * DOM elements exist *at the moment they execute* (e.g. `new Chart(document.getElementById(...))`
 * for each canvas). Dashboard renders its markup via `dangerouslySetInnerHTML`, which
 * hands the browser a brand-new, unprocessed DOM subtree on every mount — so if these
 * scripts only ran once (e.g. gated behind a "loaded already" flag), charts/icons would
 * only ever render on the very first mount and stay blank on any mount after that
 * (such as logging out and back in). Re-running them fresh each time keeps them in sync
 * with the fresh markup; old script tags from a previous mount are removed first so they
 * don't pile up in the DOM.
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

export default function Dashboard() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [assetsReady, setAssetsReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([injectDashboardAssets(), delay(MIN_LOADER_MS)]).then(() => {
      if (!cancelled) setAssetsReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const nameEl = container.querySelector<HTMLElement>('.nav-author__info h6')
    const roleEl = container.querySelector<HTMLElement>('.nav-author__info span')
    if (nameEl && user) nameEl.textContent = user.name
    if (roleEl && user) roleEl.textContent = user.email

    const signOutEl = container.querySelector<HTMLAnchorElement>('.nav-author__signout')
    const dropdown = container.querySelector<HTMLElement>('.nav-author .dropdown-custom')
    const toggleEl = dropdown?.querySelector<HTMLElement>('.nav-item-toggle')

    const cleanups: Array<() => void> = []

    if (signOutEl) {
      const handleSignOut = (event: MouseEvent) => {
        event.preventDefault()
        logout().finally(() => navigate('/login', { replace: true }))
      }
      signOutEl.addEventListener('click', handleSignOut)
      cleanups.push(() => signOutEl.removeEventListener('click', handleSignOut))
    }

    // This dropdown only opens on CSS `:hover`, with a gap between the avatar and the
    // panel below it — moving the mouse from one to the other easily drifts outside the
    // hoverable area, closing the menu (and dropping its pointer-events) before a click on
    // Logout/Profile ever lands. A click-to-toggle `.show` class is a reliable alternative.
    if (dropdown && toggleEl) {
      const handleToggle = (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        dropdown.classList.toggle('show')
      }
      const handleOutsideClick = (event: MouseEvent) => {
        if (!dropdown.contains(event.target as Node)) dropdown.classList.remove('show')
      }
      toggleEl.addEventListener('click', handleToggle)
      document.addEventListener('click', handleOutsideClick)
      cleanups.push(() => {
        toggleEl.removeEventListener('click', handleToggle)
        document.removeEventListener('click', handleOutsideClick)
      })
    }

    return () => cleanups.forEach((fn) => fn())
  }, [user, logout, navigate])

  return (
    <>
      {!assetsReady && <PageLoader />}
      <div ref={containerRef} className="dashboard-app" dangerouslySetInnerHTML={{ __html: DASHBOARD_HTML }} />
    </>
  )
}
