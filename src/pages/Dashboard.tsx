import { useEffect } from 'react'
import DASHBOARD_HTML from './dashboardContent'
import { DASHBOARD_JS_SRCS } from './dashboardAssets'
import './Dashboard.css'

let assetsInjected = false

function injectDashboardAssets() {
  if (assetsInjected) return
  assetsInjected = true

  DASHBOARD_JS_SRCS.forEach((src) => {
    const script = document.createElement('script')
    script.src = src
    // Preserves the theme's original load order (jQuery before its plugins, etc.)
    // for scripts injected dynamically after the document has already loaded.
    script.async = false
    script.dataset.dashboardAsset = 'true'
    document.body.appendChild(script)
  })
}

export default function Dashboard() {
  useEffect(() => {
    const previousBodyClass = document.body.className
    document.body.className = 'layout-light side-menu overlayScroll'
    injectDashboardAssets()

    return () => {
      document.body.className = previousBodyClass
    }
  }, [])

  return <div className="dashboard-app" dangerouslySetInnerHTML={{ __html: DASHBOARD_HTML }} />
}
