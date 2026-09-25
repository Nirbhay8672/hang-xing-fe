import { useEffect, useRef } from 'react'

/**
 * Re-runs `refresh` every `intervalMs` while the browser tab is visible, and again whenever the
 * person comes back to the tab. For lists other people change while you have them open (e.g.
 * Planning putting an item on hold while Admin is looking at the Orders page) — without it the
 * list only ever shows what was there when the page was opened.
 */
export function useAutoRefresh(refresh: () => void, intervalMs = 30_000) {
  const latest = useRef(refresh)
  latest.current = refresh

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') latest.current()
    }
    const id = setInterval(run, intervalMs)
    document.addEventListener('visibilitychange', run)
    window.addEventListener('focus', run)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('focus', run)
    }
  }, [intervalMs])
}
