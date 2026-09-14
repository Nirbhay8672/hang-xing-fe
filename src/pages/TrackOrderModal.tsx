import { useEffect, useState } from 'react'
import { ApiError } from '../auth/apiClient'
import type { Company } from '../companies/types'
import { companiesService } from '../companies/companiesService'
import '../components/detailView.css'
import '../components/statusPill.css'
import type { CompletedTask, Order, TaskRemark } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import './PlanOrderModal.css'
import './Production.css'
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
    production_progress: data.production_progress ?? 0,
    planning_tasks: data.planning_tasks ?? [],
    task_remarks: data.task_remarks ?? [],
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
  const [editingRemarkTask, setEditingRemarkTask] = useState<string | null>(null)
  const [remarkDraft, setRemarkDraft] = useState('')
  const [savingRemark, setSavingRemark] = useState(false)

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
          const taskNames = p.completed_tasks.map((ct) => ct.task)
          if (p.id !== punchId) return { id: p.id, completed_tasks: taskNames }
          const isDone = taskNames.some((t) => taskKey(t) === taskKey(task))
          return {
            id: p.id,
            completed_tasks: isDone ? taskNames.filter((t) => taskKey(t) !== taskKey(task)) : [...taskNames, task],
          }
        }),
        task_remarks: order.task_remarks ?? [],
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

  function openRemarkEditor(task: string, existing?: TaskRemark) {
    setRemarkDraft(existing?.remark ?? '')
    setEditingRemarkTask(task)
  }

  function closeRemarkEditor() {
    setEditingRemarkTask(null)
    setRemarkDraft('')
  }

  async function saveTaskRemark(task: string) {
    if (!order) return
    setSavingRemark(true)
    setSaveError(null)
    try {
      const trimmed = remarkDraft.trim()
      const existing = order.task_remarks ?? []
      const nextRemarks = trimmed
        ? [...existing.filter((r) => taskKey(r.task) !== taskKey(task)), { task, remark: trimmed }]
        : existing.filter((r) => taskKey(r.task) !== taskKey(task))
      const response = await ordersService.updateProduction(order.id, {
        punch_numbers: order.punch_numbers.map((p) => ({ id: p.id, completed_tasks: p.completed_tasks.map((ct) => ct.task) })),
        task_remarks: nextRemarks,
      })
      const updated = normalizeOrder(response)
      setOrder(updated)
      onSaved(updated)
      closeRemarkEditor()
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save remark.')
    } finally {
      setSavingRemark(false)
    }
  }

  const matchingSpec = company?.manufacturing_specifications.find((s) => s.size === order?.size) ?? null
  const isUpperPunch = order?.punch_type.startsWith('U') ?? true
  // An "other master" scoped to this order's exact punch-type variant (e.g. "U - DIN") takes
  // priority over the spec's plain Upper/Lower default, which only covers the broad side.
  const otherMasterMatch = matchingSpec?.other_masters.find((om) => om.punch_type === order?.punch_type)
  const referenceMasterNo = otherMasterMatch
    ? otherMasterMatch.master_number
    : matchingSpec
      ? isUpperPunch
        ? matchingSpec.up_master_no
        : matchingSpec.lp_master_no
      : ''
  // Only tasks actually assigned during planning show up here — an order's task list is
  // whatever was checked in the Plan modal, not always all 9 fixed steps.
  const tasks = order?.planning_tasks ?? []

  return (
    <>
      <div className="modal fade show d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-xl hx-modal-wide hx-track-modal">
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

                  <div className="hx-plan-card hx-plan-card--compact">
                    <div className="hx-detail-grid hx-detail-grid--cols3">
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
                      <div>
                        <span className="hx-detail-grid__label">Taper Details</span>
                        <span className="hx-detail-grid__value">{order.taper_details || '—'}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Punch Border</span>
                        <span className="hx-detail-grid__value">{order.punch_border || '—'}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Punch Deep</span>
                        <span className="hx-detail-grid__value">{order.punch_deep || '—'}</span>
                      </div>
                      {matchingSpec && (
                        <>
                          <div>
                            <span className="hx-detail-grid__label">Lower Punch</span>
                            <span className="hx-detail-grid__value">{matchingSpec.lower_punch || '-'}</span>
                          </div>
                          <div>
                            <span className="hx-detail-grid__label">Master No.</span>
                            <span className="hx-detail-grid__value">{referenceMasterNo || '-'}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="hx-plan-card hx-plan-card--compact">
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
                            {tasks.map((task, i) => {
                              const taskRemark = (order.task_remarks ?? []).find((r) => taskKey(r.task) === taskKey(task))
                              const isEditingRemark = editingRemarkTask === task
                              return (
                              <tr key={task}>
                                <td>
                                  <div className="hx-track-task-cell">
                                    <span className="hx-track-table__index">{String(i + 1).padStart(2, '0')}</span>
                                    <span
                                      className={
                                        order.punch_numbers.every((p) => p.completed_tasks.some((ct) => taskKey(ct.task) === taskKey(task)))
                                          ? 'hx-track-table__done'
                                          : ''
                                      }
                                    >
                                      {task}
                                    </span>
                                    <button
                                      type="button"
                                      className={`hx-track-remark-btn ${taskRemark ? 'hx-track-remark-btn--active' : ''}`}
                                      onClick={() => (isEditingRemark ? closeRemarkEditor() : openRemarkEditor(task, taskRemark))}
                                      aria-label={`${taskRemark ? 'Edit' : 'Add'} remark for ${task}`}
                                    >
                                      <i className="la la-sticky-note"></i>
                                    </button>
                                  </div>
                                  {isEditingRemark ? (
                                    <div className="hx-track-remark-editor">
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={remarkDraft}
                                        onChange={(e) => setRemarkDraft(e.target.value)}
                                        placeholder="Note an issue or change for this task…"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') saveTaskRemark(task)
                                          if (e.key === 'Escape') closeRemarkEditor()
                                        }}
                                      />
                                      <button
                                        type="button"
                                        className="hx-track-remark-save"
                                        disabled={savingRemark}
                                        onClick={() => saveTaskRemark(task)}
                                        aria-label="Save remark"
                                      >
                                        <i className="la la-check"></i>
                                      </button>
                                      <button
                                        type="button"
                                        className="hx-track-remark-cancel"
                                        disabled={savingRemark}
                                        onClick={closeRemarkEditor}
                                        aria-label="Cancel"
                                      >
                                        <i className="la la-times"></i>
                                      </button>
                                    </div>
                                  ) : (
                                    taskRemark && <span className="hx-track-remark-text">{taskRemark.remark}</span>
                                  )}
                                </td>
                                {order.punch_numbers.map((p) => {
                                  const completedEntry = p.completed_tasks.find((ct) => taskKey(ct.task) === taskKey(task))
                                  const isDone = Boolean(completedEntry)
                                  // Older API responses (or ones not yet upgraded) have no completed_at at all —
                                  // only show the tooltip once there's an actual timestamp to show.
                                  const hasTimestamp = Boolean(completedEntry?.completed_at)
                                  const key = `${p.id}:${task}`
                                  return (
                                    <td key={p.id}>
                                      <div className="hx-track-cell">
                                        <button
                                          type="button"
                                          className={`hx-track-toggle ${isDone ? 'hx-track-toggle--done' : ''} ${
                                            hasTimestamp ? 'hx-tooltip' : ''
                                          }`}
                                          data-tooltip={hasTimestamp ? `Completed ${formatDateTime(completedEntry!.completed_at)}` : undefined}
                                          disabled={savingKey === key}
                                          onClick={() => toggleTaskDone(p.id, task)}
                                          aria-label={`${task} for ${p.punch_number}`}
                                        >
                                          {isDone && <i className="la la-check"></i>}
                                        </button>
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="hx-plan-card hx-plan-card--compact">
                    <span className="hx-plan-card__title">Overall Progress</span>
                    <div className="hx-progress hx-progress--lg">
                      <div className="hx-progress__track">
                        <div className="hx-progress__fill" style={{ width: `${order.production_progress}%` }} />
                      </div>
                      <span className="hx-progress__label">{order.production_progress}%</span>
                    </div>

                    {order.remarks && (
                      <div className="hx-plan-subsection">
                        <span className="hx-plan-card__title">Order Remarks</span>
                        <p className="hx-detail-grid__value m-0">{order.remarks}</p>
                      </div>
                    )}

                    <div className="hx-plan-subsection">
                      <span className="hx-plan-card__title">Planning Remarks</span>
                      <p className="hx-detail-grid__value m-0">{order.planning_remarks || '—'}</p>
                    </div>
                  </div>

                  <div className="button-group d-flex justify-content-center pt-10">
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
