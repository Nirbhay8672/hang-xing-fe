import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { deleteRequestsService } from '../deleteRequests/deleteRequestsService'
import { SUBJECT_LABELS, type DeleteRequest, type NotificationFeed } from '../deleteRequests/types'
import './NotificationBell.css'

const POLL_INTERVAL_MS = 30_000
const MAX_ITEMS = 12

type Tone = 'pending' | 'approved' | 'rejected'

interface NotificationItem {
  key: string
  tone: Tone
  unread: boolean
  title: ReactNode
  detail: string | null
  at: string
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function buildItems(feed: NotificationFeed, freshDecisionIds: Set<number>): NotificationItem[] {
  const reviewItems = feed.pending_reviews.map<NotificationItem>((r) => ({
    key: `review-${r.id}`,
    tone: 'pending',
    unread: true,
    title: (
      <>
        <strong>{r.requester?.name ?? 'Someone'}</strong> wants to delete {SUBJECT_LABELS[r.subject_type].toLowerCase()}{' '}
        <strong>{r.subject_label}</strong>
      </>
    ),
    detail: r.reason,
    at: r.created_at,
  }))

  const decisionItems = feed.decisions.map<NotificationItem>((r: DeleteRequest) => ({
    key: `decision-${r.id}`,
    tone: r.status === 'Approved' ? 'approved' : 'rejected',
    unread: !r.requester_seen_at || freshDecisionIds.has(r.id),
    title: (
      <>
        Your request to delete {SUBJECT_LABELS[r.subject_type].toLowerCase()} <strong>{r.subject_label}</strong> was{' '}
        <strong>{r.status.toLowerCase()}</strong>
        {r.reviewer ? ` by ${r.reviewer.name}` : ''}
      </>
    ),
    detail: r.review_note,
    at: r.reviewed_at ?? r.created_at,
  }))

  return [...reviewItems, ...decisionItems].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, MAX_ITEMS)
}

/**
 * Header bell: Admin sees delete requests waiting for review; whoever raised a request sees the
 * decision on it. Polls lightly so a new request/decision shows up without a page reload.
 */
export default function NotificationBell() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const involved = can('review delete requests') || can('request delete orders') || can('request delete complaints')

  const [feed, setFeed] = useState<NotificationFeed | null>(null)
  const [open, setOpen] = useState(false)
  // Decisions that were unread when the panel opened stay highlighted while it's open, even
  // though opening it marks them read.
  const [freshDecisionIds, setFreshDecisionIds] = useState<Set<number>>(new Set())
  const rootRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      setFeed(await deleteRequestsService.notifications())
    } catch {
      // A failed poll just leaves the last known state in place.
    }
  }, [])

  useEffect(() => {
    if (!involved) return
    load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [involved, load])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)
    if (!next) return

    const unseen = feed?.decisions.filter((d) => !d.requester_seen_at) ?? []
    setFreshDecisionIds(new Set(unseen.map((d) => d.id)))
    if (unseen.length > 0) {
      deleteRequestsService.markNotificationsRead().then(load).catch(() => {})
    } else {
      load()
    }
  }

  function goToRequests() {
    setOpen(false)
    navigate('/delete-requests')
  }

  const count = feed?.unread_count ?? 0
  const items = feed ? buildItems(feed, freshDecisionIds) : []

  return (
    <div className="hx-notif" ref={rootRef}>
      <button type="button" className="hx-notif__toggle" onClick={toggle} aria-label="Notifications" aria-expanded={open}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && <span className="hx-notif__badge">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div className="hx-notif__panel" role="dialog" aria-label="Notifications">
          <div className="hx-notif__header">
            <strong>Notifications</strong>
            {count > 0 && <span className="hx-notif__count">{count} new</span>}
          </div>

          {items.length === 0 ? (
            <p className="hx-notif__empty">{involved ? 'Nothing new right now.' : 'No notifications.'}</p>
          ) : (
            <ul className="hx-notif__list">
              {items.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`hx-notif__item hx-notif__item--${item.tone}${item.unread ? ' hx-notif__item--unread' : ''}`}
                    onClick={goToRequests}
                  >
                    <span className="hx-notif__dot"></span>
                    <span className="hx-notif__body">
                      <span className="hx-notif__title">{item.title}</span>
                      {item.detail && <span className="hx-notif__detail">“{item.detail}”</span>}
                      <span className="hx-notif__time">{timeAgo(item.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {involved && (
            <button type="button" className="hx-notif__footer" onClick={goToRequests}>
              View all delete requests
            </button>
          )}
        </div>
      )}
    </div>
  )
}
