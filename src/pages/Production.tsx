import { useEffect, useState } from 'react'
import { ApiError } from '../auth/apiClient'
import AppShell from '../components/AppShell'
import OrderFilterBar, { EMPTY_ORDER_FILTERS, hasActiveOrderFilters, matchesOrderFilters, type OrderFilters } from '../components/OrderFilterBar'
import Pagination from '../components/Pagination'
import '../components/statusPill.css'
import { useAutoRefresh } from '../components/useAutoRefresh'
import { usePagination } from '../components/usePagination'
import type { Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import './Orders.css'
import './Planning.css'
import './Production.css'
import TrackOrderModal from './TrackOrderModal'

function orderTypePillClass(orderType: string): string {
  return orderType === 'New' ? 'hx-status-pill--new' : 'hx-status-pill--rc'
}

const PRODUCTION_STATUS_OPTIONS = [
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Complete', label: 'Complete' },
  { value: 'items-hold', label: 'Items on hold' },
]

function matchesProductionStatus(order: Order, status: string): boolean {
  if (!status) return true
  if (status === 'items-hold') return (order.held_items_count ?? 0) > 0
  return productionStatus(order) === status
}

function productionStatus(order: Order): string {
  return (order.production_progress ?? 0) === 100 ? 'Complete' : 'In Progress'
}

function productionStatusPillClass(order: Order): string {
  return (order.production_progress ?? 0) === 100 ? 'hx-status-pill--complete' : 'hx-status-pill--pending'
}

export default function Production() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [trackOrderId, setTrackOrderId] = useState<number | null>(null)
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_ORDER_FILTERS)

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoadError(null)
    try {
      const data = await ordersService.list()
      setOrders(data)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load orders.')
    }
  }

  // Quietly picks up changes other people made (a newly planned order, an item put on hold).
  async function refreshOrders() {
    try {
      setOrders(await ordersService.list())
    } catch {
      // keep showing what we already have
    }
  }

  useAutoRefresh(refreshOrders)

  const plannedOrders = orders ? orders.filter((o) => o.planning_status === 'Planned').sort((a, b) => b.id - a.id) : null
  const filteredOrders = (plannedOrders ?? []).filter((o) => matchesOrderFilters(o, filters) && matchesProductionStatus(o, filters.status))
  const { page, setPage, totalPages, totalItems, perPage, pageItems: pagedOrders } = usePagination(filteredOrders, 10)

  return (
    <AppShell title="Supervisor Dashboard">
      <div className="row">
        <div className="col-12">
          <p className="hx-page-subtitle">Track task completion per punch number</p>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="contact-list-wrap mb-25">
            <div className="contact-list bg-white radius-xl w-100">
              {loadError && <p className="hx-form-error m-20">{loadError}</p>}
              {plannedOrders === null && !loadError && <p className="hx-orders-empty">Loading orders…</p>}
              {plannedOrders && plannedOrders.length === 0 && <p className="hx-orders-empty">No planned orders yet.</p>}

              {plannedOrders && plannedOrders.length > 0 && (
                <OrderFilterBar
                  orders={plannedOrders}
                  filters={filters}
                  onChange={setFilters}
                  statusOptions={PRODUCTION_STATUS_OPTIONS}
                  shown={filteredOrders.length}
                  total={plannedOrders.length}
                />
              )}
              {plannedOrders && plannedOrders.length > 0 && filteredOrders.length === 0 && (
                <p className="hx-orders-empty">{hasActiveOrderFilters(filters) ? 'No orders match the filters.' : 'No planned orders yet.'}</p>
              )}

              {plannedOrders && filteredOrders.length > 0 && (
                <div className="table-responsive">
                  <table className="table mb-0 table-borderless table-rounded">
                    <thead>
                      <tr>
                        <th>
                          <span className="userDatatable-title">Order No</span>
                        </th>
                        <th>
                          <span>Company</span>
                        </th>
                        <th>
                          <span>Type</span>
                        </th>
                        <th>
                          <span>Qty</span>
                        </th>
                        <th>
                          <span>Progress</span>
                        </th>
                        <th>
                          <span>Status</span>
                        </th>
                        <th className="c-action">
                          <span className="float-right"></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedOrders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <span className="position hx-planning-order-no">{o.order_no}</span>
                          </td>
                          <td>
                            <span className="position">{o.company?.name}</span>
                          </td>
                          <td>
                            <span className={`hx-status-pill ${orderTypePillClass(o.order_type)}`}>{o.order_type}</span>
                          </td>
                          <td>
                            <span className="position">{o.quantity}</span>
                          </td>
                          <td>
                            <div className="hx-progress">
                              <div className="hx-progress__track">
                                <div className="hx-progress__fill" style={{ width: `${o.production_progress ?? 0}%` }} />
                              </div>
                              <span className="hx-progress__label">{o.production_progress ?? 0}%</span>
                            </div>
                          </td>
                          <td>
                            <span className={`hx-status-pill ${productionStatusPillClass(o)}`}>{productionStatus(o)}</span>
                            {o.held_items_count > 0 && (
                              <span className="hx-status-pill hx-status-pill--onhold hx-hold-chip">
                                {o.held_items_count}/{o.quantity} hold
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="table-actions d-flex">
                              <button type="button" className="hx-plan-btn" onClick={() => setTrackOrderId(o.id)}>
                                <i className="la la-tasks"></i> Track
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination page={page} totalPages={totalPages} totalItems={totalItems} perPage={perPage} onPageChange={setPage} />
            </div>
          </div>
        </div>
      </div>

      {trackOrderId !== null && (
        <TrackOrderModal
          orderId={trackOrderId}
          onClose={() => setTrackOrderId(null)}
          onSaved={(updated) => {
            setOrders((prev) => prev?.map((o) => (o.id === updated.id ? updated : o)) ?? null)
          }}
        />
      )}
    </AppShell>
  )
}
