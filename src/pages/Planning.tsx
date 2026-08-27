import { useEffect, useState } from 'react'
import { ApiError } from '../auth/apiClient'
import AppShell from '../components/AppShell'
import '../components/statusPill.css'
import type { Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import './Orders.css'
import './Planning.css'
import PlanOrderModal from './PlanOrderModal'

function orderTypePillClass(orderType: string): string {
  return orderType === 'New' ? 'hx-status-pill--new' : 'hx-status-pill--rc'
}

function planningStatusPillClass(status: string): string {
  return status === 'Planned' ? 'hx-status-pill--planned' : 'hx-status-pill--review'
}

export default function Planning() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [planOrderId, setPlanOrderId] = useState<number | null>(null)

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

  return (
    <AppShell title="Production Planning">
      <div className="row">
        <div className="col-12">
          <p className="hx-page-subtitle">Review, correct sizes, and assign tasks</p>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="contact-list-wrap mb-25">
            <div className="contact-list bg-white radius-xl w-100">
              {loadError && <p className="hx-form-error m-20">{loadError}</p>}
              {orders === null && !loadError && <p className="hx-orders-empty">Loading orders…</p>}
              {orders && orders.length === 0 && <p className="hx-orders-empty">No orders found.</p>}

              {orders && orders.length > 0 && (
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
                          <span>Size</span>
                        </th>
                        <th>
                          <span>Punch Type</span>
                        </th>
                        <th>
                          <span>Type</span>
                        </th>
                        <th>
                          <span>Qty</span>
                        </th>
                        <th>
                          <span>Planning</span>
                        </th>
                        <th className="c-action">
                          <span className="float-right"></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <span className="position hx-planning-order-no">{o.order_no}</span>
                          </td>
                          <td>
                            <span className="position">{o.company?.name}</span>
                          </td>
                          <td>
                            <span className="position">{o.size}</span>
                          </td>
                          <td>
                            <span className="hx-order-badge">{o.punch_type}</span>
                          </td>
                          <td>
                            <span className={`hx-status-pill ${orderTypePillClass(o.order_type)}`}>{o.order_type}</span>
                          </td>
                          <td>
                            <span className="position">{o.quantity}</span>
                          </td>
                          <td>
                            <span className={`hx-status-pill ${planningStatusPillClass(o.planning_status)}`}>
                              {o.planning_status}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions d-flex">
                              <button type="button" className="hx-plan-btn" onClick={() => setPlanOrderId(o.id)}>
                                <i className="la la-edit"></i> Plan
                              </button>
                            </div>
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

      {planOrderId !== null && (
        <PlanOrderModal
          orderId={planOrderId}
          onClose={() => setPlanOrderId(null)}
          onSaved={(updated) => {
            setOrders((prev) => prev?.map((o) => (o.id === updated.id ? updated : o)) ?? null)
            setPlanOrderId(null)
          }}
        />
      )}
    </AppShell>
  )
}
