import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { DASHBOARD_JS_SRCS } from '../pages/dashboardAssets'
import PageLoader from './PageLoader'
import './AppShell.css'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'home' },
  { to: '/users', label: 'Users', icon: 'users' },
]

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
  children: ReactNode
}

export default function AppShell({ title, children }: AppShellProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [assetsReady, setAssetsReady] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([injectDashboardAssets(), delay(MIN_LOADER_MS)]).then(() => {
      if (!cancelled) setAssetsReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Same hover-drift problem noted in the theme: moving the mouse from the avatar to the
  // panel below it easily drifts outside the hoverable area. Click-to-toggle is reliable.
  useEffect(() => {
    if (!dropdownOpen) return
    function handleOutsideClick(event: globalThis.MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [dropdownOpen])

  function handleSignOut(event: MouseEvent) {
    event.preventDefault()
    logout().finally(() => navigate('/login', { replace: true }))
  }

  function handleToggleDropdown(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    setDropdownOpen((v) => !v)
  }

  return (
    <>
      {!assetsReady && <PageLoader />}

      <div className="mobile-search">
        <form className="search-form">
          <span data-feather="search"></span>
          <input className="form-control me-sm-2 box-shadow-none" type="text" placeholder="Search..." />
        </form>
      </div>

      <div className="mobile-author-actions"></div>

      <header className="header-top">
        <nav className="navbar navbar-light">
          <div className="navbar-left">
            <a href="" className="sidebar-toggle">
              <img className="svg" src="/html/img/svg/bars.svg" alt="img" />
            </a>
            <a className="navbar-brand" href="/">
              <img className="dark" src="/images/logo.png" alt="Heng Xing" />
              <img className="light" src="/images/logo.png" alt="Heng Xing" />
            </a>
          </div>

          <div className="navbar-right">
            <ul className="navbar-right__menu">
              <li className="nav-author" ref={dropdownRef}>
                <div className={`dropdown-custom${dropdownOpen ? ' show' : ''}`}>
                  <a href="javascript:;" className="nav-item-toggle" onClick={handleToggleDropdown}>
                    <img src="/html/img/author-nav.jpg" alt="" className="rounded-circle" />
                  </a>
                  <div className="dropdown-wrapper">
                    <div className="nav-author__info">
                      <div className="author-img">
                        <img src="/html/img/author-nav.jpg" alt="" className="rounded-circle" />
                      </div>
                      <div>
                        <h6>{user?.name}</h6>
                        <span>{user?.email}</span>
                      </div>
                    </div>
                    <div className="nav-author__options">
                      <ul>
                        <li>
                          <a href="">
                            <span data-feather="user"></span> Profile
                          </a>
                        </li>
                      </ul>
                      <a href="/login" className="nav-author__signout" onClick={handleSignOut}>
                        <span data-feather="log-out"></span> Logout
                      </a>
                    </div>
                  </div>
                </div>
              </li>
            </ul>

            <div className="navbar-right__mobileAction d-md-none">
              <a href="#" className="btn-search">
                <span data-feather="search"></span>
                <span data-feather="x"></span>
              </a>
              <a href="#" className="btn-author-action">
                <span data-feather="more-vertical"></span>
              </a>
            </div>
          </div>
        </nav>
      </header>

      <main className="main-content">
        <aside className="sidebar-wrapper">
          <div className="sidebar sidebar-collapse" id="sidebar">
            <div className="sidebar__menu-group">
              <ul className="sidebar_nav">
                <li className="menu-title">
                  <span>Main menu</span>
                </li>
                {NAV_ITEMS.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
                      <span data-feather={item.icon} className="nav-icon"></span>
                      <span className="menu-text">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <div className="contents">
          <div className="container-fluid">
            <div className="page-header">
              <div className="page-header__inner">
                <h2>{title}</h2>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb bg-transparent p-0 m-0">
                    <li className="breadcrumb-item">
                      <a href="/">Home</a>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      {title}
                    </li>
                  </ol>
                </nav>
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
