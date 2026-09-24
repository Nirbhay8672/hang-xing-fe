import { useEffect, useState } from 'react'
import { ApiError } from '../auth/apiClient'
import AppShell from '../components/AppShell'
import '../components/detailView.css'
import Pagination from '../components/Pagination'
import '../components/statusPill.css'
import { usePagination } from '../components/usePagination'
import type { Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import './Orders.css'
import './Planning.css'
import PlanOrderModal from './PlanOrderModal'

function orderTypePillClass(orderType: string): string {
  return orderType === 'New' ? 'hx-status-pill--new' : 'hx-status-pill--rc'
}

function planningStatusPillClass(status: string): string {
  if (status === 'Planned') return 'hx-status-pill--planned'
  if (status === 'On Hold') return 'hx-status-pill--onhold'
  if (status === 'Approved') return 'hx-status-pill--approved'
  return 'hx-status-pill--review'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function Planning() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [planOrderId, setPlanOrderId] = useState<number | null>(null)

  // An order not yet planned must be approved (or explicitly put on hold) before the actual
  // Plan form opens — this gate only applies to Review/On Hold orders. Approving persists
  // "Approved" so the gate stays passed on later clicks too (not just for the one that
  // triggered it) right up until the order is actually Planned (see openPlanFlow below).
  const [confirmOrderId, setConfirmOrderId] = useState<number | null>(null)
  const [holdSubmitting, setHoldSubmitting] = useState(false)
  const [holdError, setHoldError] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)

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

  function openPlanFlow(order: Order) {
    if (order.planning_status === 'Planned' || order.planning_status === 'Approved') {
      setPlanOrderId(order.id)
    } else {
      setHoldError(null)
      setConfirmOrderId(order.id)
    }
  }

  function closeConfirmModal() {
    if (holdSubmitting || approving) return
    setConfirmOrderId(null)
  }

  async function handleApprove() {
    if (confirmOrderId === null) return
    setApproving(true)
    setHoldError(null)
    try {
      const updated = await ordersService.updatePlanningStatus(confirmOrderId, 'Approved')
      setOrders((prev) => prev?.map((o) => (o.id === updated.id ? updated : o)) ?? null)
      setPlanOrderId(confirmOrderId)
      setConfirmOrderId(null)
    } catch (err) {
      setHoldError(err instanceof ApiError ? err.message : 'Failed to approve order.')
    } finally {
      setApproving(false)
    }
  }

  async function handleHold() {
    if (confirmOrderId === null) return
    setHoldSubmitting(true)
    setHoldError(null)
    try {
      const updated = await ordersService.updatePlanningStatus(confirmOrderId, 'On Hold')
      setOrders((prev) => prev?.map((o) => (o.id === updated.id ? updated : o)) ?? null)
      setConfirmOrderId(null)
    } catch (err) {
      setHoldError(err instanceof ApiError ? err.message : 'Failed to put order on hold.')
    } finally {
      setHoldSubmitting(false)
    }
  }

  const confirmOrder = orders?.find((o) => o.id === confirmOrderId) ?? null

  const sortedOrders = orders ? [...orders].sort((a, b) => b.id - a.id) : []
  const { page, setPage, totalPages, totalItems, perPage, pageItems: pagedOrders } = usePagination(sortedOrders, 10)

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
                      {pagedOrders.map((o) => (
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
                              <button type="button" className="hx-plan-btn" onClick={() => openPlanFlow(o)}>
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
              <Pagination page={page} totalPages={totalPages} totalItems={totalItems} perPage={perPage} onPageChange={setPage} />
            </div>
          </div>
        </div>
      </div>

      {confirmOrder && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Approve {confirmOrder.order_no}?</h6>
                  <button type="button" className="btn-close" onClick={closeConfirmModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="hx-order-detail-hero">
                    <div>
                      <span className="hx-order-detail-hero__order-no">{confirmOrder.order_no}</span>
                      <span className="hx-order-detail-hero__company">
                        <i className="la la-building"></i>
                        {confirmOrder.company?.name}
                      </span>
                    </div>
                    <div className="hx-order-detail-hero__badges">
                      <span className={`hx-status-pill ${orderTypePillClass(confirmOrder.order_type)}`}>{confirmOrder.order_type}</span>
                      <span className="hx-order-badge">{confirmOrder.punch_type}</span>
                    </div>
                  </div>

                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Order Info</span>
                    <div className="hx-detail-grid hx-order-detail-grid">
                      <div>
                        <span className="hx-detail-grid__label">Size</span>
                        <span className="hx-detail-grid__value">{confirmOrder.size}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Quantity</span>
                        <span className="hx-detail-grid__value">{confirmOrder.quantity}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Master Number</span>
                        <span className="hx-detail-grid__value">{confirmOrder.master_number || '—'}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Order By</span>
                        <span className="hx-detail-grid__value">{confirmOrder.user?.name ?? '—'}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Expected Delivery</span>
                        <span className="hx-detail-grid__value">
                          {confirmOrder.expected_delivery_date ? formatDate(confirmOrder.expected_delivery_date) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Created</span>
                        <span className="hx-detail-grid__value">{formatDate(confirmOrder.created_at)}</span>
                      </div>
                      <div className="hx-detail-grid__full">
                        <span className="hx-detail-grid__label">Remarks</span>
                        <span className="hx-detail-grid__value">{confirmOrder.remarks || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {holdError && <p className="hx-form-error">{holdError}</p>}
                  <div className="button-group d-flex justify-content-center pt-20">
                    <button
                      type="button"
                      className="btn btn-sm hx-btn-secondary btn-rounded me-10"
                      onClick={handleHold}
                      disabled={holdSubmitting || approving}
                    >
                      {holdSubmitting ? 'Saving…' : 'On Hold'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary btn-rounded"
                      onClick={handleApprove}
                      disabled={holdSubmitting || approving}
                    >
                      {approving ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeConfirmModal}></div>
        </>
      )}

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
