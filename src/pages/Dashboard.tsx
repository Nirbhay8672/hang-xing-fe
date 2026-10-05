import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import { isAdmin } from '../auth/roleUtils'
import AppShell from '../components/AppShell'
import { useAutoRefresh } from '../components/useAutoRefresh'
import type { Company } from '../companies/types'
import { companiesService } from '../companies/companiesService'
import type { Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import type { Role } from '../roles/types'
import { rolesService } from '../roles/rolesService'
import type { User } from '../users/types'
import { usersService } from '../users/usersService'
import './Dashboard.css'

type Variant = 'navy' | 'gold' | 'teal' | 'violet' | 'sky' | 'rose' | 'amber' | 'emerald'

// Feather-style line icons, drawn inline so they render without waiting on the vendor
// icon scripts (and animate with the cards on first paint).
const ICONS: Record<string, ReactNode> = {
  building: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  box: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
    </>
  ),
  sparkle: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" />,
  repeat: (
    <>
      <path d="m17 1 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  refresh: (
    <>
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  pause: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M10 15V9M14 15V9" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  arrow: <path d="M5 12h14M12 5l7 7-7 7" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
}

function Icon({ name, size = 20 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Animates a number from 0 up to `target` once loading finishes (ease-out, ~0.9s). */
function useCountUp(target: number, loading: boolean): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (loading) return
    let frame = 0
    const start = performance.now()
    // Reduced motion (or nothing to count): jump straight to the final value on the first frame.
    const duration = prefersReducedMotion() || target === 0 ? 0 : 900
    const tick = (now: number) => {
      const t = duration ? Math.min(1, (now - start) / duration) : 1
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, loading])

  return value
}

interface StatCardProps {
  value: number
  label: string
  hint: string
  icon: keyof typeof ICONS
  variant: Variant
  loading: boolean
  index: number
  /** 0–100: fills the bar along the bottom of the card. Omit to hide the bar. */
  share?: number
  /** Makes the whole card a link to this page. */
  to?: string
}

function StatCard({ value, label, hint, icon, variant, loading, index, share, to }: StatCardProps) {
  const navigate = useNavigate()
  const shown = useCountUp(value, loading)

  return (
    <div className="col-xl-3 col-lg-4 col-6">
      <div
        className={`hx-stat hx-stat--${variant}${to ? ' hx-stat--link' : ''}`}
        style={{ '--i': index } as CSSProperties}
        onClick={to ? () => navigate(to) : undefined}
        role={to ? 'link' : undefined}
        tabIndex={to ? 0 : undefined}
        onKeyDown={to ? (e) => e.key === 'Enter' && navigate(to) : undefined}
      >
        <div className="hx-stat__top">
          <div>
            <p className="hx-stat__label">{label}</p>
            <h3 className="hx-stat__value">{loading ? <span className="hx-skeleton" /> : shown}</h3>
          </div>
          <div className="hx-stat__icon">
            <Icon name={icon} size={22} />
          </div>
        </div>
        <div className="hx-stat__foot">
          <span className="hx-stat__hint">{hint}</span>
          {to && (
            <span className="hx-stat__go">
              <Icon name="arrow" size={14} />
            </span>
          )}
        </div>
        {share !== undefined && (
          <div className="hx-stat__bar">
            <span style={{ width: loading ? 0 : `${Math.max(share, 2)}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function isOverdue(order: Order): boolean {
  if (!order.expected_delivery_date) return false
  const startOfToday = new Date(new Date().toDateString())
  return new Date(order.expected_delivery_date) < startOfToday
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function initials(name: string | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

const AVATAR_TONES: Variant[] = ['navy', 'gold', 'teal', 'violet', 'sky', 'rose', 'emerald', 'amber']
function avatarTone(name: string | undefined): Variant {
  let hash = 0
  for (const ch of name ?? '') hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]
}

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)

// Order types and the color each one wears everywhere on the dashboard.
const ORDER_TYPES: { key: string; label: string; variant: Variant }[] = [
  { key: 'New', label: 'New', variant: 'navy' },
  { key: 'RC', label: 'RC', variant: 'gold' },
  { key: 'RR', label: 'RR', variant: 'teal' },
]

function OrderMix({ orders, loading }: { orders: Order[]; loading: boolean }) {
  const total = orders.length
  const segments = ORDER_TYPES.map((t) => ({ ...t, count: orders.filter((o) => o.order_type === t.key).length }))
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const shownTotal = useCountUp(total, loading)

  let offset = 0
  return (
    <div className="hx-panel hx-panel--mix" style={{ '--i': 1 } as CSSProperties}>
      <div className="hx-panel__head">
        <div>
          <h6 className="hx-panel__title">Order mix</h6>
          <p className="hx-panel__sub">Share of orders by type</p>
        </div>
      </div>
      <div className="hx-mix">
        <div className="hx-donut">
          <svg viewBox="0 0 140 140">
            <circle className="hx-donut__track" cx="70" cy="70" r={radius} />
            {!loading &&
              total > 0 &&
              segments.map((s, i) => {
                const length = (s.count / total) * circumference
                const dash = `${Math.max(length - 3, 0)} ${circumference}`
                const el = (
                  <circle
                    key={s.key}
                    className={`hx-donut__seg hx-tone--${s.variant}`}
                    cx="70"
                    cy="70"
                    r={radius}
                    strokeDasharray={dash}
                    strokeDashoffset={-offset}
                    style={{ '--len': length, '--d': `${0.25 + i * 0.18}s` } as CSSProperties}
                  />
                )
                offset += length
                return el
              })}
          </svg>
          <div className="hx-donut__center">
            <strong>{loading ? '—' : shownTotal}</strong>
            <span>Orders</span>
          </div>
        </div>
        <ul className="hx-legend">
          {segments.map((s) => (
            <li key={s.key}>
              <Link to={`/orders?type=${s.key}`} className={`hx-legend__item hx-tone--${s.variant}`}>
                <span className="hx-legend__dot" />
                <span className="hx-legend__label">{s.label} orders</span>
                <span className="hx-legend__count">{loading ? '—' : s.count}</span>
                <span className="hx-legend__pct">{loading ? '' : `${pct(s.count, total)}%`}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function WeeklyActivity({ orders, loading }: { orders: Order[]; loading: boolean }) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (13 - i))
    return d
  })
  const counts = days.map((d) => {
    const next = new Date(d)
    next.setDate(d.getDate() + 1)
    return orders.filter((o) => {
      const created = new Date(o.created_at)
      return created >= d && created < next
    }).length
  })
  const max = Math.max(1, ...counts)
  const thisWeek = counts.slice(7).reduce((a, b) => a + b, 0)
  const lastWeek = counts.slice(0, 7).reduce((a, b) => a + b, 0)
  const diff = thisWeek - lastWeek

  return (
    <div className="hx-panel" style={{ '--i': 0 } as CSSProperties}>
      <div className="hx-panel__head">
        <div>
          <h6 className="hx-panel__title">Order activity</h6>
          <p className="hx-panel__sub">Orders received over the last 14 days</p>
        </div>
        <div className="hx-week-summary">
          <div>
            <span>This week</span>
            <strong>{loading ? '—' : thisWeek}</strong>
          </div>
          <div>
            <span>Last week</span>
            <strong>{loading ? '—' : lastWeek}</strong>
          </div>
          {!loading && (
            <span className={`hx-trend ${diff >= 0 ? 'hx-trend--up' : 'hx-trend--down'}`}>
              {diff >= 0 ? '▲' : '▼'} {Math.abs(diff)}
            </span>
          )}
        </div>
      </div>
      <div className="hx-bars" role="img" aria-label={`Orders per day, last 14 days: ${counts.join(', ')}`}>
        {days.map((d, i) => {
          const isToday = i === days.length - 1
          return (
            <div key={d.toISOString()} className={`hx-bars__col${i >= 7 ? ' is-current' : ''}${isToday ? ' is-today' : ''}`}>
              <div className="hx-bars__track">
                <span
                  className="hx-bars__fill"
                  style={{ height: loading ? 0 : `${Math.max((counts[i] / max) * 100, 4)}%`, '--d': `${i * 0.04}s` } as CSSProperties}
                >
                  {counts[i] > 0 && <em>{counts[i]}</em>}
                </span>
              </div>
              <span className="hx-bars__label">
                {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
                <small>{d.getDate()}</small>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface AttentionItem {
  key: string
  icon: keyof typeof ICONS
  variant: Variant
  title: string
  sub: string
  to: string
}

function NeedsAttention({ items, loading }: { items: AttentionItem[]; loading: boolean }) {
  return (
    <div className="hx-panel hx-panel--flush" style={{ '--i': 3 } as CSSProperties}>
      <div className="hx-panel__head hx-panel__head--pad">
        <div>
          <h6 className="hx-panel__title">Needs attention</h6>
          <p className="hx-panel__sub">Items requiring action</p>
        </div>
      </div>
      {!loading && items.length === 0 ? (
        <div className="hx-all-clear">
          <span className="hx-all-clear__icon">
            <Icon name="check" size={22} />
          </span>
          <strong>All clear</strong>
          <span>Nothing is overdue or on hold.</span>
        </div>
      ) : (
        <ul className="hx-attention">
          {items.map((item) => (
            <li key={item.key}>
              <Link to={item.to} className={`hx-attention__item hx-tone--${item.variant}`}>
                <span className="hx-attention__icon">
                  <Icon name={item.icon} size={18} />
                </span>
                <span className="hx-attention__text">
                  <strong>{item.title}</strong>
                  <span>{item.sub}</span>
                </span>
                <span className="hx-attention__chev">
                  <Icon name="chevron" size={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user, can } = useAuth()

  const admin = user ? isAdmin(user) : false
  const showCompanies = can('view companies')
  const showOrders = can('view orders')
  const showUsers = can('view users') && admin
  const showRoles = can('view roles') && admin
  // Admin is told about orders put on hold (information only — nothing to approve).
  const showHolds = can('view held orders')

  const [companiesCount, setCompaniesCount] = useState(0)
  const [orders, setOrders] = useState<Order[]>([])
  const [usersCount, setUsersCount] = useState(0)
  const [rolesCount, setRolesCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)

      const [companiesResult, ordersResult, usersResult, rolesResult] = await Promise.allSettled([
        showCompanies ? companiesService.list() : Promise.resolve<Company[]>([]),
        showOrders ? ordersService.list() : Promise.resolve<Order[]>([]),
        showUsers ? usersService.list() : Promise.resolve<User[]>([]),
        showRoles ? rolesService.list() : Promise.resolve<Role[]>([]),
      ])
      if (cancelled) return

      if (companiesResult.status === 'fulfilled') setCompaniesCount(companiesResult.value.length)
      if (ordersResult.status === 'fulfilled') setOrders(ordersResult.value)
      if (usersResult.status === 'fulfilled') setUsersCount(usersResult.value.length)
      if (rolesResult.status === 'fulfilled') setRolesCount(rolesResult.value.length)

      const failed = [companiesResult, ordersResult, usersResult, rolesResult].find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined
      if (failed) {
        setLoadError(failed.reason instanceof ApiError ? failed.reason.message : 'Some dashboard data failed to load.')
      }

      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [showCompanies, showOrders, showUsers, showRoles])

  useAutoRefresh(() => {
    if (showOrders) ordersService.list().then(setOrders).catch(() => {})
  })

  const totalOrders = orders.length
  const newOrders = orders.filter((o) => o.order_type === 'New').length
  const rcOrders = orders.filter((o) => o.order_type === 'RC').length
  const rrOrders = orders.filter((o) => o.order_type === 'RR').length
  const overdueOrders = orders.filter(isOverdue).length
  // Orders with something on hold: the whole order, or some of its items.
  const heldOrdersCount = orders.filter((o) => o.planning_status === 'On Hold' || o.held_items_count > 0).length
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)

  const startOfWeek = new Date()
  startOfWeek.setHours(0, 0, 0, 0)
  startOfWeek.setDate(startOfWeek.getDate() - 6)
  const ordersThisWeek = orders.filter((o) => new Date(o.created_at) >= startOfWeek).length

  const attention: AttentionItem[] = []
  if (overdueOrders > 0) {
    attention.push({
      key: 'overdue',
      icon: 'clock',
      variant: 'rose',
      title: `${overdueOrders} overdue ${overdueOrders === 1 ? 'delivery' : 'deliveries'}`,
      sub: 'Past their expected delivery date',
      to: '/orders',
    })
  }
  if (showHolds && heldOrdersCount > 0) {
    attention.push({
      key: 'hold',
      icon: 'pause',
      variant: 'amber',
      title: `${heldOrdersCount} ${heldOrdersCount === 1 ? 'order' : 'orders'} on hold`,
      sub: 'Whole order or some items paused',
      to: '/orders?tab=hold',
    })
  }

  const noWidgets = !showCompanies && !showOrders && !showUsers && !showRoles
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const firstName = user?.name?.split(' ')[0] ?? ''

  let cardIndex = 0
  const next = () => cardIndex++

  return (
    <AppShell title="Dashboard">
      <div className="hx-dash">
        <section className="hx-hero">
          <div className="hx-hero__orb hx-hero__orb--a" />
          <div className="hx-hero__orb hx-hero__orb--b" />
          <div className="hx-hero__orb hx-hero__orb--c" />
          <div className="hx-hero__body">
            <span className="hx-hero__date">
              <Icon name="calendar" size={14} />
              {today}
            </span>
            <h2 className="hx-hero__title">
              {greeting()}
              {firstName && (
                <>
                  , <span>{firstName}</span>
                </>
              )}
            </h2>
            <p className="hx-hero__sub">Here’s what’s happening across orders and production today.</p>
            {showOrders && (
              <Link to="/orders" className="hx-hero__cta">
                View orders <Icon name="arrow" size={16} />
              </Link>
            )}
          </div>
          {showOrders && (
            <div className="hx-hero__chips">
              <div className="hx-chip">
                <span className="hx-chip__label">This week</span>
                <strong>{loading ? '—' : ordersThisWeek}</strong>
                <span className="hx-chip__sub">new orders</span>
              </div>
              <div className="hx-chip hx-chip--warn">
                <span className="hx-chip__label">Overdue</span>
                <strong>{loading ? '—' : overdueOrders}</strong>
                <span className="hx-chip__sub">deliveries</span>
              </div>
              {showHolds && (
                <div className="hx-chip hx-chip--gold">
                  <span className="hx-chip__label">On hold</span>
                  <strong>{loading ? '—' : heldOrdersCount}</strong>
                  <span className="hx-chip__sub">orders</span>
                </div>
              )}
            </div>
          )}
        </section>

        {loadError && <p className="hx-form-error">{loadError}</p>}

        {noWidgets ? (
          <p className="hx-orders-empty">Nothing to show here yet.</p>
        ) : (
          <>
            <div className="row hx-stat-row">
              {showOrders && (
                <StatCard
                  index={next()}
                  value={totalOrders}
                  label="Total Orders"
                  hint="All orders on record"
                  icon="box"
                  variant="navy"
                  loading={loading}
                  to="/orders"
                />
              )}
              {showOrders && (
                <StatCard
                  index={next()}
                  value={newOrders}
                  label="New Orders"
                  hint={`${pct(newOrders, totalOrders)}% of all orders`}
                  icon="sparkle"
                  variant="violet"
                  share={pct(newOrders, totalOrders)}
                  loading={loading}
                  to="/orders?type=New"
                />
              )}
              {showOrders && (
                <StatCard
                  index={next()}
                  value={rcOrders}
                  label="RC Orders"
                  hint={`${pct(rcOrders, totalOrders)}% of all orders`}
                  icon="repeat"
                  variant="gold"
                  share={pct(rcOrders, totalOrders)}
                  loading={loading}
                  to="/orders?type=RC"
                />
              )}
              {showOrders && (
                <StatCard
                  index={next()}
                  value={rrOrders}
                  label="RR Orders"
                  hint={`${pct(rrOrders, totalOrders)}% of all orders`}
                  icon="refresh"
                  variant="teal"
                  share={pct(rrOrders, totalOrders)}
                  loading={loading}
                  to="/orders?type=RR"
                />
              )}
              {showOrders && (
                <StatCard
                  index={next()}
                  value={overdueOrders}
                  label="Overdue Deliveries"
                  hint={overdueOrders ? 'Past expected date' : 'Everything on time'}
                  icon="clock"
                  variant="rose"
                  loading={loading}
                />
              )}
              {showOrders && showHolds && (
                <StatCard
                  index={next()}
                  value={heldOrdersCount}
                  label="Orders On Hold"
                  hint="Whole order or some items"
                  icon="pause"
                  variant="amber"
                  loading={loading}
                  to="/orders?tab=hold"
                />
              )}
              {showCompanies && (
                <StatCard
                  index={next()}
                  value={companiesCount}
                  label="Companies"
                  hint="Registered customers"
                  icon="building"
                  variant="sky"
                  loading={loading}
                  to="/companies"
                />
              )}
              {showUsers && (
                <StatCard
                  index={next()}
                  value={usersCount}
                  label="Users"
                  hint="Team members with access"
                  icon="users"
                  variant="emerald"
                  loading={loading}
                />
              )}
              {showRoles && (
                <StatCard
                  index={next()}
                  value={rolesCount}
                  label="Roles"
                  hint="Permission groups"
                  icon="shield"
                  variant="navy"
                  loading={loading}
                />
              )}
            </div>

            {showOrders && (
              <>
                <div className="row">
                  <div className="col-xl-8 col-12 hx-col">
                    <WeeklyActivity orders={orders} loading={loading} />
                  </div>
                  <div className="col-xl-4 col-12 hx-col">
                    <OrderMix orders={orders} loading={loading} />
                  </div>
                </div>

                <div className="row">
                  <div className="col-xl-8 col-12 hx-col">
                    <div className="hx-panel hx-panel--flush" style={{ '--i': 2 } as CSSProperties}>
                      <div className="hx-panel__head hx-panel__head--pad">
                        <div>
                          <h6 className="hx-panel__title">Recent orders</h6>
                          <p className="hx-panel__sub">The latest orders received</p>
                        </div>
                        <Link to="/orders" className="hx-link">
                          View all <Icon name="chevron" size={14} />
                        </Link>
                      </div>
                      {!loading && orders.length === 0 && <p className="hx-orders-empty">No orders found.</p>}
                      {recentOrders.length > 0 && (
                        <div className="table-responsive">
                          <table className="table mb-0 table-borderless hx-recent">
                            <thead>
                              <tr>
                                <th>Order No.</th>
                                <th>Company</th>
                                <th>Size</th>
                                <th>Type</th>
                                <th>Expected Delivery</th>
                              </tr>
                            </thead>
                            <tbody>
                              {recentOrders.map((o, i) => {
                                const type = ORDER_TYPES.find((t) => t.key === o.order_type)
                                const overdue = isOverdue(o)
                                return (
                                  <tr key={o.id} style={{ '--r': i } as CSSProperties}>
                                    <td>
                                      <span className="hx-recent__no">{o.order_no}</span>
                                    </td>
                                    <td>
                                      <span className="hx-recent__company">
                                        <span className={`hx-avatar hx-tone--${avatarTone(o.company?.name)}`}>
                                          {initials(o.company?.name)}
                                        </span>
                                        {o.company?.name}
                                      </span>
                                    </td>
                                    <td>{o.size}</td>
                                    <td>
                                      <span className={`hx-type hx-tone--${type?.variant ?? 'navy'}`}>{o.order_type}</span>
                                    </td>
                                    <td>
                                      {o.expected_delivery_date ? (
                                        <span className={`hx-due${overdue ? ' hx-due--late' : ''}`}>
                                          {formatDate(o.expected_delivery_date)}
                                          {overdue && <em>Overdue</em>}
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {/* Phones get the same orders as stacked cards instead of a table that
                          needs sideways scrolling; CSS shows one or the other. */}
                      {recentOrders.length > 0 && (
                        <ul className="hx-recent-list">
                          {recentOrders.map((o, i) => {
                            const type = ORDER_TYPES.find((t) => t.key === o.order_type)
                            const overdue = isOverdue(o)
                            return (
                              <li key={o.id} style={{ '--r': i } as CSSProperties}>
                                <span className={`hx-avatar hx-tone--${avatarTone(o.company?.name)}`}>
                                  {initials(o.company?.name)}
                                </span>
                                <div className="hx-recent-list__main">
                                  <div className="hx-recent-list__row">
                                    <span className="hx-recent__no">{o.order_no}</span>
                                    <span className={`hx-type hx-tone--${type?.variant ?? 'navy'}`}>{o.order_type}</span>
                                  </div>
                                  <div className="hx-recent-list__company">
                                    {o.company?.name} · {o.size}
                                  </div>
                                  {o.expected_delivery_date && (
                                    <span className={`hx-due${overdue ? ' hx-due--late' : ''}`}>
                                      <Icon name="calendar" size={12} />
                                      {formatDate(o.expected_delivery_date)}
                                      {overdue && <em>Overdue</em>}
                                    </span>
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="col-xl-4 col-12 hx-col">
                    <NeedsAttention items={attention} loading={loading} />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
