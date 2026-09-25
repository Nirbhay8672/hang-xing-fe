import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { deleteRequestsService } from '../deleteRequests/deleteRequestsService'
import { SUBJECT_LABELS, type DeleteRequest, type NotificationFeed } from '../deleteRequests/types'
import './NotificationBell.css'

const POLL_INTERVAL_MS = 30_000
const MAX_ITEMS = 12

type Tone = 'pending' | 'approved' | 'rejected' | 'hold'

interface NotificationItem {
  key: string
  tone: Tone
  unread: boolean
  title: ReactNode
  detail: string | null
  at: string
  /** Where clicking the item goes. */
  path: string
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

const decisionKey = (id: number) => `decision-${id}`
const holdKey = (id: number) => `hold-${id}`

/** Keys of the notifications that are still unread on the server. */
function unreadKeys(feed: NotificationFeed | null): string[] {
  if (!feed) return []
  return [
    ...feed.decisions.filter((d) => !d.requester_seen_at).map((d) => decisionKey(d.id)),
    ...(feed.held_orders ?? []).filter((h) => h.unread).map((h) => holdKey(h.id)),
  ]
}

function buildItems(feed: NotificationFeed, freshKeys: Set<string>): NotificationItem[] {
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
    path: '/delete-requests',
  }))

  const decisionItems = feed.decisions.map<NotificationItem>((r: DeleteRequest) => ({
    key: decisionKey(r.id),
    tone: r.status === 'Approved' ? 'approved' : 'rejected',
    unread: !r.requester_seen_at || freshKeys.has(decisionKey(r.id)),
    title: (
      <>
        Your request to delete {SUBJECT_LABELS[r.subject_type].toLowerCase()} <strong>{r.subject_label}</strong> was{' '}
        <strong>{r.status.toLowerCase()}</strong>
        {r.reviewer ? ` by ${r.reviewer.name}` : ''}
      </>
    ),
    detail: r.review_note,
    at: r.reviewed_at ?? r.created_at,
    path: '/delete-requests',
  }))

  // Information only — an order was put on hold; there is nothing for the admin to approve.
  const holdItems = (feed.held_orders ?? []).map<NotificationItem>((h) => ({
    key: holdKey(h.id),
    tone: 'hold',
    unread: h.unread || freshKeys.has(holdKey(h.id)),
    title: (
      <>
        <strong>{h.holder?.name ?? 'Someone'}</strong> put{' '}
        {h.whole_order ? (
          <>
            order <strong>{h.order_no}</strong>
          </>
        ) : (
          <>
            <strong>
              {h.held_items}/{h.quantity}
            </strong>{' '}
            items of order <strong>{h.order_no}</strong>
          </>
        )}
        {h.company ? ` — ${h.company.name}` : ''} on hold
      </>
    ),
    detail: null,
    at: h.held_at ?? new Date(0).toISOString(),
    path: '/orders?tab=hold',
  }))

  return [...reviewItems, ...decisionItems, ...holdItems]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, MAX_ITEMS)
}

/**
 * Header bell: Admin sees delete requests waiting for review and orders put on hold; whoever
 * raised a delete request sees the decision on it. Polls lightly so new items show up without a
 * page reload.
 */
export default function NotificationBell() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const involved =
    can('review delete requests') || can('request delete orders') || can('request delete complaints') || can('view held orders')
  const seesDeleteRequests = can('review delete requests') || can('request delete orders') || can('request delete complaints')

  const [feed, setFeed] = useState<NotificationFeed | null>(null)
  const [open, setOpen] = useState(false)
  // Items that were unread when the panel opened stay highlighted while it's open, even
  // though opening it marks them read.
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set())
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

    const unseen = unreadKeys(feed)
    setFreshKeys(new Set(unseen))
    if (unseen.length > 0) {
      deleteRequestsService.markNotificationsRead().then(load).catch(() => {})
    } else {
      load()
    }
  }

  function goTo(path: string) {
    setOpen(false)
    navigate(path)
  }

  const count = feed?.unread_count ?? 0
  const items = feed ? buildItems(feed, freshKeys) : []

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
                    onClick={() => goTo(item.path)}
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

          {seesDeleteRequests && (
            <button type="button" className="hx-notif__footer" onClick={() => goTo('/delete-requests')}>
              View all delete requests
            </button>
          )}
        </div>
      )}
    </div>
  )
}
