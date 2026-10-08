import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { deleteRequestsService } from '../deleteRequests/deleteRequestsService'
import {
  SUBJECT_LABELS,
  type DeleteRequest,
  type HeldOrderNotification,
  type NewOrderNotification,
  type NotificationFeed,
} from '../deleteRequests/types'
import { NOTIFICATIONS_REFRESH_EVENT } from './notificationEvents'
import './NotificationBell.css'

const POLL_INTERVAL_MS = 30_000
const MAX_ITEMS = 12

// Desktop-popup bookkeeping, one store per kind of event (holds, new orders): the event keys this
// browser has already popped for this user, so the same event never pops twice — capped so it
// can't grow forever over months of use. Separate stores so each kind gets its own "first run"
// backlog handling (see popDesktopEvents).
const NOTIFIED_HOLDS_STORAGE_PREFIX = 'hx.notified-holds.'
const NOTIFIED_NEW_ORDERS_STORAGE_PREFIX = 'hx.notified-new-orders.'
const NOTIFIED_KEYS_CAP = 300

// A desktop popup is "news" only for an order booked within this window — older ones (e.g. the
// first time the alerts are switched on for someone) still show in the bell, just without popping.
const NEW_ORDER_POPUP_MAX_AGE_MS = 15 * 60_000

/** One hold notification identified by order + exact hold time, so a resumed-then-re-held order
 * pops a fresh desktop notification rather than being treated as the same event. */
function holdEventKey(h: HeldOrderNotification): string {
  return `${h.id}:${h.held_at ?? ''}`
}

/** `neverRunBefore` reflects whether this browser has used the feature before *at all* (i.e.
 * whether localStorage already held a key), not just whether this component instance has — a
 * page reload must still notify for anything new, not treat it all as backlog again. */
function loadNotifiedKeys(storageKey: string): { keys: Set<string>; neverRunBefore: boolean } {
  try {
    const raw = localStorage.getItem(storageKey)
    return { keys: raw ? new Set(JSON.parse(raw)) : new Set(), neverRunBefore: raw === null }
  } catch {
    return { keys: new Set(), neverRunBefore: true }
  }
}

function saveNotifiedKeys(storageKey: string, keys: Set<string>): void {
  try {
    // Keep only the most recently added keys — insertion order in a Set is preserved, so this
    // drops the oldest ones once the cap is hit.
    const trimmed = Array.from(keys).slice(-NOTIFIED_KEYS_CAP)
    localStorage.setItem(storageKey, JSON.stringify(trimmed))
  } catch {
    // Private browsing / storage disabled — desktop notifications may repeat, nothing else breaks.
  }
}

interface DesktopEvent {
  key: string
  title: string
  body: string
  path: string
}

/** Per-kind desktop-popup state: the seen keys (null until loaded for the signed-in user) and
 * whether this browser has never run this kind before (its first batch is backlog). */
interface SeenStore {
  keys: Set<string> | null
  neverRunBefore: boolean | null
}

/** "Arvind Mishra booked order HX/26/10/003 — ABC" (popup text; the bell list uses rich text). */
function newOrderNotificationBody(o: NewOrderNotification): string {
  const who = o.created_by?.name ?? 'Someone'
  const where = o.company ? ` — ${o.company.name}` : ''
  return `${who} booked order ${o.order_no}${where} · ${newOrderDetail(o)}`
}

/** "RC · 300 x 600 · 7 pcs" */
function newOrderDetail(o: NewOrderNotification): string {
  return [o.order_type, o.size, `${o.quantity} pc${o.quantity === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
}

/** The popup's text — same wording as the bell's own list entry, just as plain text. */
function holdNotificationBody(h: HeldOrderNotification): string {
  const who = h.holder?.name ?? 'Someone'
  const what = h.whole_order ? `order ${h.order_no}` : `${h.held_items}/${h.quantity} items of order ${h.order_no}`
  const where = h.company ? ` — ${h.company.name}` : ''
  return `${who} put ${what}${where} on hold`
}

type Tone = 'pending' | 'approved' | 'rejected' | 'hold' | 'new'

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
const newOrderKey = (id: number) => `new-order-${id}`

/** Keys of the notifications that are still unread on the server. */
function unreadKeys(feed: NotificationFeed | null): string[] {
  if (!feed) return []
  return [
    ...feed.decisions.filter((d) => !d.requester_seen_at).map((d) => decisionKey(d.id)),
    ...(feed.held_orders ?? []).filter((h) => h.unread).map((h) => holdKey(h.id)),
    ...(feed.new_orders ?? []).filter((o) => o.unread).map((o) => newOrderKey(o.id)),
  ]
}

/** `newOrderPath`: where a new-order notification leads for this person (see NotificationBell). */
function buildItems(feed: NotificationFeed, freshKeys: Set<string>, newOrderPath: string): NotificationItem[] {
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

  // A freshly booked order, for whoever has new-order notifications switched on.
  const newOrderItems = (feed.new_orders ?? []).map<NotificationItem>((o) => ({
    key: newOrderKey(o.id),
    tone: 'new',
    unread: o.unread || freshKeys.has(newOrderKey(o.id)),
    title: (
      <>
        <strong>{o.created_by?.name ?? 'Someone'}</strong> booked new order <strong>{o.order_no}</strong>
        {o.company ? ` — ${o.company.name}` : ''}
      </>
    ),
    detail: newOrderDetail(o),
    at: o.created_at ?? new Date(0).toISOString(),
    path: newOrderPath,
  }))

  return [...reviewItems, ...decisionItems, ...holdItems, ...newOrderItems]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, MAX_ITEMS)
}

/**
 * Header bell: Admin sees delete requests waiting for review and orders put on hold; people
 * with "notify new orders" switched on see newly booked orders; whoever
 * raised a delete request sees the decision on it. Polls lightly so new items show up without a
 * page reload.
 */
export default function NotificationBell() {
  const { can, user } = useAuth()
  const navigate = useNavigate()
  const seesDeleteRequests = can('review delete requests') || can('request delete orders') || can('request delete complaints')
  const seesHolds = can('view held orders')
  // Set per person by an Admin on the Users page (not by role).
  const seesNewOrders = user?.notify_new_orders === true
  const involved = seesDeleteRequests || seesHolds || seesNewOrders
  const getsDesktopAlerts = seesHolds || seesNewOrders
  // New-order notifications go to several roles, so each opens a page that person can reach:
  // Planning reviews the order, Marketing sees it in Orders, Production on its own dashboard.
  const newOrderPath = can('access planning') ? '/planning' : can('view orders') ? '/orders' : '/production'

  const [feed, setFeed] = useState<NotificationFeed | null>(null)
  const [open, setOpen] = useState(false)
  // 'unsupported' when this browser has no Notification API at all (rare). Read once on mount —
  // there's no reliable cross-browser event for "the site permission changed elsewhere", so this
  // only updates again when the person explicitly clicks Enable below.
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  // Items that were unread when the panel opened stay highlighted while it's open, even
  // though opening it marks them read.
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set())
  const rootRef = useRef<HTMLDivElement>(null)
  // Desktop-popup state for each kind of event (see SeenStore). The keys load lazily, once the
  // user id is known, and stay null beforehand so the first poll of this mount can tell "not
  // loaded yet" apart from "loaded, and the set happens to be empty". neverRunBefore reflects
  // every past page load, not just this mount — otherwise a genuinely new event right after a
  // reload would wrongly be treated as backlog.
  const holdStoreRef = useRef<SeenStore>({ keys: null, neverRunBefore: null })
  const newOrderStoreRef = useRef<SeenStore>({ keys: null, neverRunBefore: null })

  // Desktop popups for new events, on top of (not instead of) the bell's own badge/list — which
  // stays the system of record for what's unread. Only once permission has been granted.
  const popDesktopEvents = useCallback(
    (store: SeenStore, storagePrefix: string, events: DesktopEvent[]) => {
      if (!user || typeof Notification === 'undefined' || Notification.permission !== 'granted') return

      const storageKey = storagePrefix + user.id
      if (store.keys === null) {
        const loaded = loadNotifiedKeys(storageKey)
        store.keys = loaded.keys
        store.neverRunBefore = loaded.neverRunBefore
      }
      const seen = store.keys
      // Only this one batch is backlog — flip it off immediately so every later poll (even still
      // within this same mount) pops normally for anything genuinely new.
      const isBacklogBatch = store.neverRunBefore === true
      store.neverRunBefore = false

      for (const event of events) {
        if (seen.has(event.key)) continue
        seen.add(event.key)
        // The very first time this runs for this person, whatever is already there is a backlog,
        // not news — seed it as "seen" quietly instead of popping a burst of old notifications.
        if (isBacklogBatch) continue

        const notification = new Notification(event.title, { body: event.body, tag: event.key })
        notification.onclick = () => {
          window.focus()
          navigate(event.path)
          notification.close()
        }
      }
      saveNotifiedKeys(storageKey, seen)
    },
    [user, navigate],
  )

  const load = useCallback(async () => {
    try {
      const data = await deleteRequestsService.notifications()
      setFeed(data)
      if (seesHolds) {
        popDesktopEvents(
          holdStoreRef.current,
          NOTIFIED_HOLDS_STORAGE_PREFIX,
          (data.held_orders ?? []).map((h) => ({
            key: holdEventKey(h),
            title: 'Order put on hold',
            body: holdNotificationBody(h),
            path: '/orders?tab=hold',
          })),
        )
      }
      if (seesNewOrders) {
        popDesktopEvents(
          newOrderStoreRef.current,
          NOTIFIED_NEW_ORDERS_STORAGE_PREFIX,
          (data.new_orders ?? [])
            .filter((o) => o.created_at && Date.now() - new Date(o.created_at).getTime() < NEW_ORDER_POPUP_MAX_AGE_MS)
            .map((o) => ({
            key: String(o.id),
            title: 'New order booked',
            body: newOrderNotificationBody(o),
            path: newOrderPath,
          })),
        )
      }
    } catch {
      // A failed poll just leaves the last known state in place.
    }
  }, [seesHolds, seesNewOrders, newOrderPath, popDesktopEvents])

  useEffect(() => {
    if (!involved) return
    load()
    const id = setInterval(load, POLL_INTERVAL_MS)
    // Something just happened in this tab (e.g. an order was booked) — check straight away.
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, load)
    return () => {
      clearInterval(id)
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, load)
    }
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

  // A dedicated, visible action (the banner's "Enable" button below) rather than an invisible
  // side-effect of opening the bell — Chrome and others require a direct user gesture for the
  // real permission prompt to appear at all, and some browsers replace it with a quiet,
  // easy-to-miss address-bar icon for a site they don't yet trust; a clearly-labelled button
  // gives the clearest possible signal of intent, and surfaces the result either way.
  function requestDesktopPermission() {
    if (typeof Notification === 'undefined') return
    Notification.requestPermission()
      .then(setDesktopPermission)
      .catch(() => setDesktopPermission(Notification.permission))
  }

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
  const items = feed ? buildItems(feed, freshKeys, newOrderPath) : []

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

          {getsDesktopAlerts && desktopPermission === 'default' && (
            <div className="hx-notif__permission">
              <span>
                Get a desktop alert the moment{' '}
                {seesNewOrders && seesHolds
                  ? 'a new order is booked or an order is put on hold'
                  : seesNewOrders
                    ? 'a new order is booked'
                    : 'an order is put on hold'}
                .
              </span>
              <button type="button" className="hx-notif__permission-btn" onClick={requestDesktopPermission}>
                Enable
              </button>
            </div>
          )}
          {getsDesktopAlerts && desktopPermission === 'denied' && (
            <div className="hx-notif__permission hx-notif__permission--blocked">
              Desktop alerts are blocked for this site. Allow notifications for it in your browser's site settings
              (usually via the icon next to the address bar), then reopen this panel.
            </div>
          )}

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
                      {/* A typed reason/note reads as a quote; an order summary doesn't. */}
                      {item.detail && (
                        <span className="hx-notif__detail">{item.tone === 'new' ? item.detail : `“${item.detail}”`}</span>
                      )}
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
