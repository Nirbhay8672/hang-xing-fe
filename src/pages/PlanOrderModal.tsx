import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/apiClient'
import type { Company } from '../companies/types'
import { companiesService } from '../companies/companiesService'
import { FloatingInput } from '../components/FloatingField'
import '../components/detailView.css'
import '../components/formStyles.css'
import '../components/statusPill.css'
import type { Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import './Orders.css'
import './PlanOrderModal.css'

const TASK_STEPS = ['Milling RA', 'FACE', 'Hole – Loading', 'Welding', 'Grinding', 'Final R.A', 'Radius', 'Resin', 'Dispatch']

function orderTypePillClass(orderType: string): string {
  return orderType === 'New' ? 'hx-status-pill--new' : 'hx-status-pill--rc'
}

// RC punch numbers were optional (and could be left blank) at order-creation time, but by
// planning they need to be locked in — one non-empty value per piece — so this pads/trims
// whatever was saved out to exactly `quantity` slots instead of generating anything.
function resizeBlankPunchNumbers(quantity: number, current: string[]): string[] {
  if (quantity <= 0) return []
  if (current.length === quantity) return current
  if (current.length > quantity) return current.slice(0, quantity)
  return [...current, ...Array.from({ length: quantity - current.length }, () => '')]
}

interface PlanOrderModalProps {
  orderId: number
  onClose: () => void
  onSaved: (order: Order) => void
}

export default function PlanOrderModal({ orderId, onClose, onSaved }: PlanOrderModalProps) {
  const [order, setOrder] = useState<Order | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [size, setSize] = useState('')
  const [masterNumber, setMasterNumber] = useState('')
  const [millingSize, setMillingSize] = useState('')
  const [facingThickness, setFacingThickness] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [rcPunchNumbers, setRcPunchNumbers] = useState<string[]>([])
  const [remarks, setRemarks] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    loadOrder()
  }, [orderId])

  async function loadOrder() {
    setLoadError(null)
    try {
      const data = await ordersService.get(orderId)
      setOrder(data)
      setSize(data.size)
      setMasterNumber(data.master_number)
      setMillingSize(data.milling_size ?? '')
      setFacingThickness(data.facing_thickness ?? '')
      setSelectedTasks(data.planning_tasks ?? [])
      setRcPunchNumbers(resizeBlankPunchNumbers(data.quantity, data.punch_numbers.map((p) => p.punch_number)))
      setRemarks(data.planning_remarks ?? '')
      // The company embedded on an order response is a lightweight summary (no
      // manufacturing_specifications) — fetch the full record for the size reference lookup.
      const fullCompany = await companiesService.get(data.company_id)
      setCompany(fullCompany)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load order.')
    }
  }

  function toggleTask(step: string) {
    setSelectedTasks((prev) => (prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]))
  }

  function toggleAllTasks() {
    setSelectedTasks((prev) => (prev.length === TASK_STEPS.length ? [] : [...TASK_STEPS]))
  }

  function handleRcPunchChange(index: number, value: string) {
    setRcPunchNumbers((prev) => prev.map((n, i) => (i === index ? value : n)))
  }

  function handleClose() {
    if (saving) return
    onClose()
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!order) return
    if (order.order_type === 'RC' && rcPunchNumbers.some((n) => n.trim() === '')) {
      setSaveError('Enter a punch number for every piece before saving the plan.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await ordersService.updatePlanning(order.id, {
        size,
        master_number: masterNumber,
        milling_size: millingSize,
        facing_thickness: facingThickness,
        planning_tasks: selectedTasks,
        planning_remarks: remarks,
        planning_status: 'Planned',
        ...(order.order_type === 'RC' ? { punch_numbers: rcPunchNumbers } : {}),
      })
      onSaved(updated)
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save plan.')
    } finally {
      setSaving(false)
    }
  }

  const matchingSpec = company?.manufacturing_specifications.find((s) => s.size === order?.size) ?? null
  const isUpperPunch = order?.punch_type.startsWith('U') ?? true
  const referenceMasterNo = matchingSpec ? (isUpperPunch ? matchingSpec.up_master_no : matchingSpec.lp_master_no) : ''

  return (
    <>
      <div className="modal fade show d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content radius-xl">
            <div className="modal-header">
              <h6 className="modal-title fw-500">{order ? `Planning — ${order.order_no}` : 'Planning'}</h6>
              <button type="button" className="btn-close" onClick={handleClose} aria-label="Close">
                <i className="las la-times"></i>
              </button>
            </div>
            <div className="modal-body">
              {loadError && <p className="hx-form-error">{loadError}</p>}
              {!order && !loadError && <p className="hx-orders-empty">Loading order…</p>}

              {order && (
                <form onSubmit={handleSave} autoComplete="off">
                  {saveError && <p className="hx-form-error">{saveError}</p>}

                  <div className="hx-plan-card">
                    <div className="hx-detail-grid">
                      <div>
                        <span className="hx-detail-grid__label">Company</span>
                        <span className="hx-detail-grid__value">{order.company?.name}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Order Type</span>
                        <span className={`hx-status-pill ${orderTypePillClass(order.order_type)}`}>{order.order_type}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Punch Type</span>
                        <span className="hx-detail-grid__value">{order.punch_type}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Punch Nos</span>
                        {order.order_type === 'New' ? (
                          order.punch_numbers.length > 0 ? (
                            <div className="hx-order-badges">
                              {order.punch_numbers.map((p) => (
                                <span key={p.id} className="hx-order-badge">
                                  {p.punch_number}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="hx-detail-grid__value">—</span>
                          )
                        ) : (
                          <span className="hx-detail-grid__value">Enter below</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {order.order_type === 'RC' && (
                    <div className="hx-plan-card">
                      <span className="hx-plan-card__title">
                        Punch Numbers — required, {rcPunchNumbers.filter((n) => n.trim() !== '').length} / {rcPunchNumbers.length}{' '}
                        entered
                      </span>
                      <div className="hx-punch-inputs">
                        {rcPunchNumbers.map((n, i) => (
                          <input
                            key={i}
                            type="text"
                            className="form-control hx-punch-input"
                            placeholder={`Punch ${i + 1}`}
                            value={n}
                            onChange={(e) => handleRcPunchChange(i, e.target.value)}
                            required
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="hx-plan-card">
                    <span className="hx-plan-card__title">Corrections &amp; Planning Fields</span>
                    <div className="row">
                      <div className="col-md-6">
                        <FloatingInput
                          label="Size (editable)"
                          type="text"
                          variant="default"
                          value={size}
                          onChange={(e) => setSize(e.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <FloatingInput
                          label="Master Number (editable)"
                          type="text"
                          variant="default"
                          value={masterNumber}
                          onChange={(e) => setMasterNumber(e.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <FloatingInput
                          label="Milling Size"
                          type="text"
                          variant="default"
                          value={millingSize}
                          onChange={(e) => setMillingSize(e.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <FloatingInput
                          label="Facing Thickness"
                          type="text"
                          variant="default"
                          value={facingThickness}
                          onChange={(e) => setFacingThickness(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hx-plan-card">
                    <span className="hx-plan-card__title">Size Details Reference</span>
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
                    <div className="hx-plan-card__header">
                      <span className="hx-plan-card__title hx-plan-card__title--inline">
                        Task Assignment — {selectedTasks.length} / {TASK_STEPS.length} selected
                      </span>
                      <button type="button" className="hx-plan-select-all" onClick={toggleAllTasks}>
                        {selectedTasks.length === TASK_STEPS.length ? 'Clear All' : 'Select All'}
                      </button>
                    </div>
                    <div className="hx-plan-tasks">
                      {TASK_STEPS.map((step, i) => (
                        <label key={step} className="hx-plan-task-row">
                          <input type="checkbox" checked={selectedTasks.includes(step)} onChange={() => toggleTask(step)} />
                          <span className="hx-plan-task-row__index">{String(i + 1).padStart(2, '0')}</span>
                          <span className="hx-plan-task-row__name">{step}</span>
                          {selectedTasks.includes(step) && <span className="hx-status-pill hx-status-pill--planned">Assigned</span>}
                        </label>
                      ))}
                    </div>
                  </div>

                  {order.remarks && (
                    <div className="hx-plan-card">
                      <span className="hx-plan-card__title">Order Remarks</span>
                      <p className="hx-detail-grid__value m-0">{order.remarks}</p>
                    </div>
                  )}

                  <div className="hx-plan-card">
                    <span className="hx-plan-card__title">Planning Remarks</span>
                    <textarea
                      className="form-control hx-plan-remarks"
                      rows={3}
                      placeholder="Planning notes…"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </div>

                  <div className="button-group d-flex justify-content-center pt-20">
                    <button
                      type="button"
                      className="btn btn-sm hx-btn-secondary btn-rounded me-10"
                      onClick={handleClose}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-sm btn-primary btn-rounded" disabled={saving}>
                      {saving ? 'Saving…' : 'Save Plan'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={handleClose}></div>
    </>
  )
}
