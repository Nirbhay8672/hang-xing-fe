import { useEffect, useState } from 'react'
import { ApiError } from '../auth/apiClient'
import type { Company } from '../companies/types'
import { companiesService } from '../companies/companiesService'
import '../components/detailView.css'
import type { Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import './PlanOrderModal.css'
import './Production.css'
import './TrackOrderModal.css'

// The backend doesn't send `completed_tasks`/`production_progress` yet, so both come back
// undefined — default them here rather than crashing every `.includes()`/`.every()` call.
function normalizeOrder(data: Order): Order {
  return {
    ...data,
    production_progress: data.production_progress ?? 0,
    punch_numbers: data.punch_numbers.map((p) => ({ ...p, completed_tasks: p.completed_tasks ?? [] })),
  }
}

interface TrackOrderModalProps {
  orderId: number
  onClose: () => void
  onSaved: (order: Order) => void
}

export default function TrackOrderModal({ orderId, onClose, onSaved }: TrackOrderModalProps) {
  const [order, setOrder] = useState<Order | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    loadOrder()
  }, [orderId])

  async function loadOrder() {
    setLoadError(null)
    try {
      const data = await ordersService.get(orderId)
      setOrder(normalizeOrder(data))
      const fullCompany = await companiesService.get(data.company_id)
      setCompany(fullCompany)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load order.')
    }
  }

  async function toggleTaskDone(punchId: number, task: string) {
    if (!order) return
    setSavingKey(`${punchId}:${task}`)
    setSaveError(null)
    try {
      const response = await ordersService.updateProduction(order.id, {
        punch_numbers: order.punch_numbers.map((p) => {
          if (p.id !== punchId) return { id: p.id, completed_tasks: p.completed_tasks }
          const isDone = p.completed_tasks.includes(task)
          return { id: p.id, completed_tasks: isDone ? p.completed_tasks.filter((t) => t !== task) : [...p.completed_tasks, task] }
        }),
      })
      const updated = normalizeOrder(response)
      setOrder(updated)
      onSaved(updated)
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save progress.')
    } finally {
      setSavingKey(null)
    }
  }

  const matchingSpec = company?.manufacturing_specifications.find((s) => s.size === order?.size) ?? null
  const isUpperPunch = order?.punch_type.startsWith('U') ?? true
  const referenceMasterNo = matchingSpec ? (isUpperPunch ? matchingSpec.up_master_no : matchingSpec.lp_master_no) : ''
  // Only tasks actually assigned during planning show up here — an order's task list is
  // whatever was checked in the Plan modal, not always all 9 fixed steps.
  const tasks = order?.planning_tasks ?? []

  return (
    <>
      <div className="modal fade show d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content radius-xl">
            <div className="modal-header">
              <h6 className="modal-title fw-500">{order ? `Track — ${order.order_no}` : 'Track'}</h6>
              {order && (
                <div className="hx-track-modal-progress">
                  <span className="hx-track-modal-progress__label">Progress</span>
                  <span className="hx-track-modal-progress__percent">{order.production_progress}%</span>
                </div>
              )}
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close">
                <i className="las la-times"></i>
              </button>
            </div>
            <div className="modal-body">
              {loadError && <p className="hx-form-error">{loadError}</p>}
              {!order && !loadError && <p className="hx-orders-empty">Loading order…</p>}

              {order && (
                <>
                  {saveError && <p className="hx-form-error">{saveError}</p>}

                  <div className="hx-plan-card">
                    <div className="hx-detail-grid">
                      <div>
                        <span className="hx-detail-grid__label">Company</span>
                        <span className="hx-detail-grid__value">{order.company?.name}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Punch Type</span>
                        <span className="hx-detail-grid__value">{order.punch_type}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Order Type</span>
                        <span className="hx-detail-grid__value">{order.order_type}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Size</span>
                        <span className="hx-detail-grid__value">{order.size}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Milling Size</span>
                        <span className="hx-detail-grid__value">{order.milling_size || '—'}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Facing Thickness</span>
                        <span className="hx-detail-grid__value">{order.facing_thickness || '—'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hx-plan-card">
                    <span className="hx-plan-card__title">Size Details</span>
                    {matchingSpec ? (
                      <div className="hx-plan-ref-grid">
                        <div>
                          <span className="hx-detail-grid__label">Size</span>
                          <span className="hx-detail-grid__value">{matchingSpec.size}</span>
                        </div>
                        <div>
                          <span className="hx-detail-grid__label">Greentile Thick</span>
                          <span className="hx-detail-grid__value">{matchingSpec.greentile_thick || '-'}</span>
                        </div>
                        <div>
                          <span className="hx-detail-grid__label">Upper Punch</span>
                          <span className="hx-detail-grid__value">{matchingSpec.upper_punch || '-'}</span>
                        </div>
                        <div>
                          <span className="hx-detail-grid__label">Lower Punch</span>
                          <span className="hx-detail-grid__value">{matchingSpec.lower_punch || '-'}</span>
                        </div>
                        <div>
                          <span className="hx-detail-grid__label">Cavity</span>
                          <span className="hx-detail-grid__value">{matchingSpec.cavity || '-'}</span>
                        </div>
                        <div>
                          <span className="hx-detail-grid__label">Master No.</span>
                          <span className="hx-detail-grid__value">{referenceMasterNo || '-'}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="hx-orders-empty">No matching specification found for this size.</p>
                    )}
                  </div>

                  <div className="hx-plan-card">
                    {tasks.length === 0 ? (
                      <p className="hx-orders-empty">No tasks were assigned during planning.</p>
                    ) : order.punch_numbers.length === 0 ? (
                      <p className="hx-orders-empty">This order has no punch numbers.</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="hx-track-table">
                          <thead>
                            <tr>
                              <th>Task</th>
                              {order.punch_numbers.map((p) => (
                                <th key={p.id}>{p.punch_number}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tasks.map((task, i) => (
                              <tr key={task}>
                                <td>
                                  <span className="hx-track-table__index">{String(i + 1).padStart(2, '0')}</span>
                                  <span
                                    className={
                                      order.punch_numbers.every((p) => p.completed_tasks.includes(task)) ? 'hx-track-table__done' : ''
                                    }
                                  >
                                    {task}
                                  </span>
                                </td>
                                {order.punch_numbers.map((p) => {
                                  const isDone = p.completed_tasks.includes(task)
                                  const key = `${p.id}:${task}`
                                  return (
                                    <td key={p.id}>
                                      <button
                                        type="button"
                                        className={`hx-track-toggle ${isDone ? 'hx-track-toggle--done' : ''}`}
                                        disabled={savingKey === key}
                                        onClick={() => toggleTaskDone(p.id, task)}
                                        aria-label={`${task} for ${p.punch_number}`}
                                      >
                                        {isDone && <i className="la la-check"></i>}
                                      </button>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="hx-plan-card">
                    <span className="hx-plan-card__title">Overall Progress</span>
                    <div className="hx-progress hx-progress--lg">
                      <div className="hx-progress__track">
                        <div className="hx-progress__fill" style={{ width: `${order.production_progress}%` }} />
                      </div>
                      <span className="hx-progress__label">{order.production_progress}%</span>
                    </div>
                  </div>

                  <div className="hx-plan-card">
                    <span className="hx-plan-card__title">Remarks</span>
                    <p className="hx-detail-grid__value m-0">{order.planning_remarks || '—'}</p>
                  </div>

                  <div className="button-group d-flex justify-content-center pt-20">
                    <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded" onClick={onClose}>
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
    </>
  )
}
