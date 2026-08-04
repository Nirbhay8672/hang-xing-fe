import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import PageLoader from './PageLoader'

// Keeps the branded loader on screen for at least this long — on a warm cache the auth
// check can resolve in a handful of milliseconds, too fast for it to read as "showing" at all.
const MIN_LOADER_MS = 500

export default function Layout({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  useEffect(() => {
    // These theme classes are shared layout scaffolding (sidebar/topbar behavior, base
    // typography) needed regardless of route, so they're set once here rather than
    // toggled per-page. "loaded" specifically defeats the theme's own unconditional
    // `body::after` full-screen overlay (see PageLoader for the replacement loader).
    // "overlayScroll" maps to `overflow: hidden` in the theme CSS — the vendor theme
    // only keeps it on body while its own preloader is visible, then removes it once
    // the page finishes loading (see theme_assets/js/main.js's `window load` handler).
    document.body.classList.add('layout-light', 'side-menu', 'overlayScroll', 'loaded')
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setMinTimeElapsed(true), MIN_LOADER_MS)
    return () => clearTimeout(id)
  }, [])

  const showLoader = status === 'loading' || !minTimeElapsed

  useEffect(() => {
    if (!showLoader) {
      document.body.classList.remove('overlayScroll')
    }
  }, [showLoader])

  return (
    <>
      {showLoader && <PageLoader />}
      {children}
    </>
  )
}
