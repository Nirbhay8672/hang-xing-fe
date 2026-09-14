import { useEffect, useState } from 'react'
import { ApiError } from '../auth/apiClient'
import '../components/statusPill.css'
import type { CompletedTask, Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import './TrackOrderModal.css'

// The backend may still be sending `completed_tasks` as plain task-name strings (the shape
// before completion timestamps existed) rather than the newer `{ task, completed_at }`
// objects — accept either so a not-yet-upgraded API doesn't crash the whole modal.
function normalizeCompletedTask(entry: string | CompletedTask): CompletedTask {
  if (typeof entry === 'string') return { task: entry, completed_at: '' }
  return { task: entry?.task ?? '', completed_at: entry?.completed_at ?? '' }
}

// The backend sends `punch_numbers`/`planning_tasks` as null (not []) before an order has
// gone through the relevant step — default both here rather than crashing every `.map()`/
// `.some()` call.
function normalizeOrder(data: Order): Order {
  return {
    ...data,
    planning_tasks: data.planning_tasks ?? [],
    punch_numbers: (data.punch_numbers ?? []).map((p) => ({
      ...p,
      completed_tasks: (p.completed_tasks ?? []).map(normalizeCompletedTask),
    })),
  }
}

// Tolerates a stray case/whitespace mismatch between a `planning_tasks` entry and the
// `completed_tasks[].task` values the backend stores for it.
function taskKey(task: string): string {
  return task.trim().toLowerCase()
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Compact form for showing inline under a checkmark, where the tooltip's full date would be
// too wide — e.g. "Sep 7, 2026, 11:21 AM". Year is included so a completion from a prior year
// doesn't get mistaken for one from the current year once several years of orders pile up.
function formatShortDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface OrderProgressModalProps {
  orderId: number
  onClose: () => void
}

export default function OrderProgressModal({ orderId, onClose }: OrderProgressModalProps) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    loadOrder()
  }, [orderId])

  async function loadOrder() {
    setLoadError(null)
    try {
      const data = await ordersService.get(orderId)
      setOrder(normalizeOrder(data))
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load order.')
    }
  }

  const tasks = order?.planning_tasks ?? []
  const punchNumbers = order?.punch_numbers ?? []

  return (
    <>
      <div className="modal fade show d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-xl hx-modal-wide">
          <div className="modal-content radius-xl">
            <div className="modal-header">
              <h6 className="modal-title fw-500">{order ? `Task Progress — ${order.order_no}` : 'Task Progress'}</h6>
              {order?.planned_at && <span className="hx-track-planned-at">Planned @ {formatDateTime(order.planned_at)}</span>}
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close">
                <i className="las la-times"></i>
              </button>
            </div>
            <div className="modal-body">
              {loadError && <p className="hx-form-error">{loadError}</p>}
              {!order && !loadError && <p className="hx-orders-empty">Loading…</p>}

              {order &&
                (tasks.length === 0 ? (
                  <p className="hx-orders-empty">No tasks were assigned during planning.</p>
                ) : punchNumbers.length === 0 ? (
                  <p className="hx-orders-empty">This order has no punch numbers.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="hx-track-table">
                      <thead>
                        <tr>
                          <th>Task</th>
                          {punchNumbers.map((p) => (
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
                                  punchNumbers.every((p) => p.completed_tasks.some((ct) => taskKey(ct.task) === taskKey(task)))
                                    ? 'hx-track-table__done'
                                    : ''
                                }
                              >
                                {task}
                              </span>
                            </td>
                            {punchNumbers.map((p) => {
                              const completedEntry = p.completed_tasks.find((ct) => taskKey(ct.task) === taskKey(task))
                              const isDone = Boolean(completedEntry)
                              // Older API responses (or ones not yet upgraded) have no completed_at at all —
                              // only show the tooltip once there's an actual timestamp to show.
                              const hasTimestamp = Boolean(completedEntry?.completed_at)
                              return (
                                <td key={p.id}>
                                  <div className="hx-track-cell">
                                    {hasTimestamp ? (
                                      <span
                                        className="hx-track-cell__date hx-tooltip"
                                        data-tooltip={`Completed ${formatDateTime(completedEntry!.completed_at)}`}
                                      >
                                        <i className="la la-check-circle hx-track-check"></i>
                                        {formatShortDateTime(completedEntry!.completed_at)}
                                      </span>
                                    ) : (
                                      <i
                                        className={`la ${isDone ? 'la-check-circle hx-track-check' : 'la-times-circle hx-track-cross'}`}
                                        aria-label={`${task} for ${p.punch_number}: ${isDone ? 'complete' : 'not complete'}`}
                                      ></i>
                                    )}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
    </>
  )
}
