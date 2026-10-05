import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import PageLoader from './PageLoader'

export default function Layout({ children }: { children: ReactNode }) {
  const { status } = useAuth()

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

  // Only while the saved sign-in is being checked when the app is first opened — never on
  // navigation, which happens in-app without reloading anything.
  const showLoader = status === 'loading'

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
