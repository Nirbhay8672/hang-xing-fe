import { useEffect, useState } from 'react'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import { isAdmin } from '../auth/roleUtils'
import AppShell from '../components/AppShell'
import type { Company } from '../companies/types'
import { companiesService } from '../companies/companiesService'
import type { Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import type { Role } from '../roles/types'
import { rolesService } from '../roles/rolesService'
import type { User } from '../users/types'
import { usersService } from '../users/usersService'
import './Dashboard.css'

interface Bar {
  x: number
  y: number
  h: number
}

type Variant = 'amber' | 'violet' | 'rose' | 'teal' | 'indigo' | 'slate'

interface StatCardProps {
  value: number
  label: string
  variant: Variant
  loading: boolean
}

const BARS: Record<Variant, Bar[]> = {
  amber: [
    { x: 0, y: 16, h: 10 },
    { x: 7, y: 10, h: 16 },
    { x: 14, y: 14, h: 12 },
    { x: 21, y: 4, h: 22 },
    { x: 28, y: 8, h: 18 },
  ],
  violet: [
    { x: 0, y: 12, h: 14 },
    { x: 7, y: 6, h: 20 },
    { x: 14, y: 16, h: 10 },
    { x: 21, y: 2, h: 24 },
    { x: 28, y: 10, h: 16 },
  ],
  rose: [
    { x: 0, y: 18, h: 8 },
    { x: 7, y: 8, h: 18 },
    { x: 14, y: 14, h: 12 },
    { x: 21, y: 0, h: 26 },
    { x: 28, y: 6, h: 20 },
  ],
  teal: [
    { x: 0, y: 14, h: 12 },
    { x: 7, y: 18, h: 8 },
    { x: 14, y: 6, h: 20 },
    { x: 21, y: 10, h: 16 },
    { x: 28, y: 2, h: 24 },
  ],
  indigo: [
    { x: 0, y: 10, h: 16 },
    { x: 7, y: 16, h: 10 },
    { x: 14, y: 2, h: 24 },
    { x: 21, y: 12, h: 14 },
    { x: 28, y: 6, h: 20 },
  ],
  slate: [
    { x: 0, y: 8, h: 18 },
    { x: 7, y: 14, h: 12 },
    { x: 14, y: 18, h: 8 },
    { x: 21, y: 6, h: 20 },
    { x: 28, y: 12, h: 14 },
  ],
}

function StatCard({ value, label, variant, loading }: StatCardProps) {
  return (
    <div className="col-xl-3 col-lg-4 col-md-6 col-12">
      <div className="card hx-stat-card">
        <div className="card-body d-flex align-items-center justify-content-between">
          <div>
            <h3 className="hx-stat-card__value">{loading ? '—' : value}</h3>
            <p className="hx-stat-card__label">{label}</p>
          </div>
          <div className={`hx-stat-card__icon hx-stat-card__icon--${variant}`}>
            <svg width="34" height="26" viewBox="0 0 34 26" fill="none">
              {BARS[variant].map((bar) => (
                <rect key={bar.x} x={bar.x} y={bar.y} width="4" height={bar.h} rx="1" fill="currentColor" />
              ))}
            </svg>
          </div>
        </div>
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

export default function Dashboard() {
  const { user, can } = useAuth()

  const admin = user ? isAdmin(user) : false
  const showCompanies = can('view companies')
  const showOrders = can('view orders')
  const showUsers = can('view users') && admin
  const showRoles = can('view roles') && admin

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

  const totalOrders = orders.length
  const newOrders = orders.filter((o) => o.order_type === 'New').length
  const rcOrders = orders.filter((o) => o.order_type === 'RC').length
  const overdueOrders = orders.filter(isOverdue).length
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const noWidgets = !showCompanies && !showOrders && !showUsers && !showRoles

  return (
    <AppShell title="Dashboard">
      {loadError && <p className="hx-form-error">{loadError}</p>}

      {noWidgets ? (
        <p className="hx-orders-empty">Nothing to show here yet.</p>
      ) : (
        <>
          <div className="row">
            {showCompanies && <StatCard value={companiesCount} label="Companies" variant="amber" loading={loading} />}
            {showOrders && <StatCard value={totalOrders} label="Total Orders" variant="violet" loading={loading} />}
            {showOrders && <StatCard value={newOrders} label="New Orders" variant="teal" loading={loading} />}
            {showOrders && <StatCard value={rcOrders} label="RC Orders" variant="indigo" loading={loading} />}
            {showOrders && <StatCard value={overdueOrders} label="Overdue Deliveries" variant="rose" loading={loading} />}
            {showUsers && <StatCard value={usersCount} label="Users" variant="slate" loading={loading} />}
            {showRoles && <StatCard value={rolesCount} label="Roles" variant="amber" loading={loading} />}
          </div>

          {showOrders && (
            <div className="row">
              <div className="col-12">
                <div className="contact-list-wrap mb-25">
                  <h6 className="hx-dashboard-panel-title">Recent Orders</h6>
                  <div className="contact-list bg-white radius-xl w-100">
                    {!loading && orders.length === 0 && <p className="hx-orders-empty">No orders found.</p>}
                    {recentOrders.length > 0 && (
                      <div className="table-responsive">
                        <table className="table mb-0 table-borderless table-rounded">
                          <thead>
                            <tr>
                              <th>
                                <span className="userDatatable-title">Order No.</span>
                              </th>
                              <th>
                                <span>Company</span>
                              </th>
                              <th>
                                <span>Size</span>
                              </th>
                              <th>
                                <span>Type</span>
                              </th>
                              <th>
                                <span>Expected Delivery</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentOrders.map((o) => (
                              <tr key={o.id}>
                                <td>
                                  <span className="position">{o.order_no}</span>
                                </td>
                                <td>
                                  <span className="position">{o.company?.name}</span>
                                </td>
                                <td>
                                  <span className="position">{o.size}</span>
                                </td>
                                <td>
                                  <span className="hx-order-badge">{o.order_type}</span>
                                </td>
                                <td>
                                  <span className="position">
                                    {o.expected_delivery_date ? formatDate(o.expected_delivery_date) : '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
