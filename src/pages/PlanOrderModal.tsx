import { useEffect, useRef, useState, type FormEvent } from 'react'
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

const BASE_TASK_STEPS = ['Milling RA', 'FACE', 'Hole – Loading', 'Welding', 'Grinding', 'Final R.A', 'Radius', 'Resin', 'Dispatch']

// "Heater" only applies to repeat orders (RC/RR) — inserted right after "Radius" so it stays
// in the same relative spot New orders would have had it, had they needed it.
function taskStepsForOrderType(orderType: string): string[] {
  if (orderType !== 'RC' && orderType !== 'RR') return BASE_TASK_STEPS
  const radiusIndex = BASE_TASK_STEPS.indexOf('Radius')
  return [...BASE_TASK_STEPS.slice(0, radiusIndex + 1), 'Heater', ...BASE_TASK_STEPS.slice(radiusIndex + 1)]
}

function orderTypePillClass(orderType: string): string {
  return orderType === 'New' ? 'hx-status-pill--new' : 'hx-status-pill--rc'
}

// The backend sends `punch_numbers`/`planning_tasks` as null (not []) for an order that
// hasn't gone through the relevant step yet, so default them here rather than crashing.
function normalizeOrder(data: Order): Order {
  return {
    ...data,
    punch_numbers: data.punch_numbers ?? [],
    planning_tasks: data.planning_tasks ?? [],
  }
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

type FieldErrors = Record<string, string>

const FIELD_KEYS: Record<string, true> = {
  planning_tasks: true,
  size: true,
  master_number: true,
  milling_size: true,
  facing_thickness: true,
  punch_border: true,
  punch_numbers: true,
}

interface PlanOrderModalProps {
  orderId: number
  onClose: () => void
  onSaved: (order: Order) => void
  /** Called when the order changes without the modal closing (e.g. items put on hold). */
  onUpdated?: (order: Order) => void
}

export default function PlanOrderModal({ orderId, onClose, onSaved, onUpdated }: PlanOrderModalProps) {
  const [order, setOrder] = useState<Order | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [size, setSize] = useState('')
  const [masterNumber, setMasterNumber] = useState('')
  const [millingSize, setMillingSize] = useState('')
  const [facingThickness, setFacingThickness] = useState('')
  const [taperDetails, setTaperDetails] = useState('')
  const [punchBorder, setPunchBorder] = useState('')
  const [punchDeep, setPunchDeep] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [rcPunchNumbers, setRcPunchNumbers] = useState<string[]>([])
  const [remarks, setRemarks] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const formRef = useRef<HTMLFormElement>(null)

  // Item (punch number) holds save straight away — they don't wait for "Save Plan".
  const [holdBusy, setHoldBusy] = useState<number | 'all' | null>(null)
  const [holdError, setHoldError] = useState<string | null>(null)

  useEffect(() => {
    loadOrder()
  }, [orderId])

  async function loadOrder() {
    setLoadError(null)
    try {
      const data = normalizeOrder(await ordersService.get(orderId))
      setOrder(data)
      setSize(data.size)
      setMasterNumber(data.master_number)
      setMillingSize(data.milling_size ?? '')
      setFacingThickness(data.facing_thickness ?? '')
      setTaperDetails(data.taper_details ?? '')
      setPunchBorder(data.punch_border ?? '')
      setPunchDeep(data.punch_deep ?? '')
      setSelectedTasks(data.planning_tasks)
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

  const taskSteps = taskStepsForOrderType(order?.order_type ?? '')

  // One tile per item of the order (its quantity). Items without a saved punch number yet
  // (RC/RR numbers are entered during planning) can't be held until that number is saved.
  const savedItems = [...(order?.punch_numbers ?? [])].sort((a, b) => a.id - b.id)
  const itemSlots = Array.from({ length: Math.max(order?.quantity ?? 0, savedItems.length) }, (_, index) => ({
    index,
    item: savedItems[index] ?? null,
  }))
  const heldItemsCount = savedItems.filter((item) => item.is_on_hold).length
  const allItemsHeld = savedItems.length > 0 && heldItemsCount === savedItems.length

  function toggleTask(step: string) {
    setSelectedTasks((prev) => (prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]))
    clearFieldError('planning_tasks')
  }

  function toggleAllTasks() {
    setSelectedTasks((prev) => (prev.length === taskSteps.length ? [] : [...taskSteps]))
    clearFieldError('planning_tasks')
  }

  function handleRcPunchChange(index: number, value: string) {
    setRcPunchNumbers((prev) => prev.map((n, i) => (i === index ? value : n)))
    clearFieldError('punch_numbers')
  }

  async function toggleItemsHold(ids: number[], onHold: boolean) {
    if (!order || ids.length === 0) return
    setHoldBusy(ids.length === 1 ? ids[0] : 'all')
    setHoldError(null)
    try {
      const updated = normalizeOrder(await ordersService.setItemsHold(order.id, ids, onHold))
      // Only the hold data is refreshed — unsaved edits in the form below stay as they are.
      setOrder((prev) =>
        prev
          ? { ...prev, punch_numbers: updated.punch_numbers, held_items_count: updated.held_items_count, item_hold: updated.item_hold }
          : updated,
      )
      onUpdated?.(updated)
    } catch (err) {
      setHoldError(err instanceof ApiError ? err.message : 'Could not update the hold. Please try again.')
    } finally {
      setHoldBusy(null)
    }
  }

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _removed, ...rest } = prev
      return rest
    })
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    if (size.trim() === '') errors.size = 'Size is required.'
    if (masterNumber.trim() === '') errors.master_number = 'Master number is required.'
    if (millingSize.trim() === '') errors.milling_size = 'Milling size is required.'
    if (facingThickness.trim() === '') errors.facing_thickness = 'Facing thickness is required.'
    if (punchBorder.trim() === '') errors.punch_border = 'Punch border is required.'
    if (order && order.order_type !== 'New' && rcPunchNumbers.some((n) => n.trim() === '')) {
      errors.punch_numbers = 'Enter a punch number for every piece.'
    }
    if (selectedTasks.length === 0) errors.planning_tasks = 'Select at least one task to assign.'
    return errors
  }

  function focusFirstInvalid() {
    // Runs after React has re-rendered the inputs with their error state applied.
    setTimeout(() => {
      const first =
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        formRef.current?.querySelector<HTMLElement>('.hx-section-error')
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      first?.focus({ preventScroll: true })
    }, 0)
  }

  function handleClose() {
    if (saving) return
    onClose()
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!order) return
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setSaveError(null)
      focusFirstInvalid()
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
        taper_details: taperDetails,
        punch_border: punchBorder,
        punch_deep: punchDeep,
        planning_tasks: selectedTasks,
        planning_remarks: remarks,
        planning_status: 'Planned',
        ...(order.order_type !== 'New' ? { punch_numbers: rcPunchNumbers } : {}),
      })
      onSaved(updated)
    } catch (err) {
      // Server-side validation failures on the fields above land inline too; anything else
      // (or a field this form has no slot for) falls back to the banner message.
      const serverErrors = err instanceof ApiError ? err.body?.errors : undefined
      const inline: FieldErrors = {}
      if (serverErrors) {
        for (const [key, messages] of Object.entries(serverErrors)) {
          const field = key.startsWith('punch_numbers') ? 'punch_numbers' : key.startsWith('planning_tasks') ? 'planning_tasks' : key
          if (field in FIELD_KEYS) inline[field] = messages[0]
        }
      }
      if (Object.keys(inline).length > 0) {
        setFieldErrors(inline)
        setSaveError(null)
        focusFirstInvalid()
      } else {
        setSaveError(err instanceof ApiError ? err.message : 'Failed to save plan.')
      }
    } finally {
      setSaving(false)
    }
  }

  // Prefer the spec(s) actually selected for this order (specification_ids) over a plain size
  // string match — a company can have several spec rows sharing one size, and the order's size
  // itself can be free-typed/corrected right here on this page, so a loose string match can
  // silently miss even when the order clearly has an associated spec.
  const specMatches = company
    ? order?.specification_ids && order.specification_ids.length > 0
      ? company.manufacturing_specifications.filter((s) => order.specification_ids.includes(s.id))
      : company.manufacturing_specifications.filter((s) => s.size === order?.size)
    : []
  const matchingSpec = specMatches[0] ?? null
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
                <form ref={formRef} onSubmit={handleSave} autoComplete="off" noValidate>
                  {saveError && <p className="hx-form-error">{saveError}</p>}

                  <div className="hx-plan-card hx-plan-card--compact">
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
                    </div>

                    <div className="hx-plan-subsection">
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
                  </div>

                  <div className="hx-plan-card hx-plan-card--compact">
                    <div className="hx-plan-card__header">
                      <span className="hx-plan-card__title hx-plan-card__title--inline">
                        Items — {heldItemsCount} of {order.quantity} on hold
                      </span>
                      {savedItems.length > 0 && (
                        <button
                          type="button"
                          className="hx-plan-select-all"
                          onClick={() => toggleItemsHold(savedItems.map((item) => item.id), !allItemsHeld)}
                          disabled={holdBusy !== null}
                        >
                          {allItemsHeld ? 'Resume All' : 'Hold All'}
                        </button>
                      )}
                    </div>
                    <p className="hx-plan-items-hint">
                      Hold an item to set it aside while the rest of the order carries on. Admin sees how many items are on hold.
                    </p>
                    {holdError && <p className="hx-form-error">{holdError}</p>}
                    <div className="hx-items-grid">
                      {itemSlots.map(({ index, item }) => {
                        const busy = item !== null && (holdBusy === item.id || holdBusy === 'all')
                        return (
                          <div
                            key={item?.id ?? `empty-${index}`}
                            className={`hx-item-tile${item?.is_on_hold ? ' hx-item-tile--held' : ''}${item ? '' : ' hx-item-tile--empty'}`}
                            title={item?.is_on_hold && item.holder ? `Put on hold by ${item.holder.name}` : undefined}
                          >
                            <span className="hx-item-tile__index">{String(index + 1).padStart(2, '0')}</span>
                            <span className="hx-item-tile__body">
                              <span className="hx-item-tile__number">{item ? item.punch_number : 'Punch number not saved yet'}</span>
                              {item?.is_on_hold && <span className="hx-item-tile__meta">On hold</span>}
                            </span>
                            <button
                              type="button"
                              className="hx-item-tile__btn"
                              disabled={!item || holdBusy !== null}
                              title={item ? undefined : 'Enter and save this punch number before holding it'}
                              onClick={() => item && toggleItemsHold([item.id], !item.is_on_hold)}
                            >
                              <i className={busy ? 'la la-spinner la-spin' : item?.is_on_hold ? 'la la-play' : 'la la-pause'}></i>{' '}
                              {item?.is_on_hold ? 'Resume' : 'Hold'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {order.order_type !== 'New' && (
                    <div className="hx-plan-card hx-plan-card--compact">
                      <span className="hx-plan-card__title">
                        Punch Numbers — required, {rcPunchNumbers.filter((n) => n.trim() !== '').length} / {rcPunchNumbers.length}{' '}
                        entered
                      </span>
                      <div className="hx-punch-inputs">
                        {rcPunchNumbers.map((n, i) => {
                          const invalid = Boolean(fieldErrors.punch_numbers) && n.trim() === ''
                          return (
                            <input
                              key={i}
                              type="text"
                              className={`form-control hx-punch-input${invalid ? ' hx-punch-input--invalid' : ''}`}
                              placeholder={`Punch ${i + 1}`}
                              value={n}
                              onChange={(e) => handleRcPunchChange(i, e.target.value)}
                              aria-invalid={invalid ? true : undefined}
                            />
                          )
                        })}
                      </div>
                      {fieldErrors.punch_numbers && <small className="hx-field-error">{fieldErrors.punch_numbers}</small>}
                    </div>
                  )}

                  <div className="hx-plan-card hx-plan-card--compact">
                    <span className="hx-plan-card__title">Corrections &amp; Planning Fields</span>
                    <div className="row mt-3">
                      <div className="col-md-6">
                        <FloatingInput
                          label="Size (editable)"
                          type="text"
                          variant="default"
                          value={size}
                          onChange={(e) => {
                            setSize(e.target.value)
                            clearFieldError('size')
                          }}
                          error={fieldErrors.size}
                        />
                      </div>
                      <div className="col-md-6">
                        <FloatingInput
                          label="Master Number (editable)"
                          type="text"
                          variant="default"
                          value={masterNumber}
                          onChange={(e) => {
                            setMasterNumber(e.target.value)
                            clearFieldError('master_number')
                          }}
                          error={fieldErrors.master_number}
                        />
                      </div>
                      <div className="col-md-6">
                        <FloatingInput
                          label="Milling Size"
                          type="text"
                          variant="default"
                          value={millingSize}
                          onChange={(e) => {
                            setMillingSize(e.target.value)
                            clearFieldError('milling_size')
                          }}
                          error={fieldErrors.milling_size}
                        />
                      </div>
                      <div className="col-md-6">
                        <FloatingInput
                          label="Facing Thickness"
                          type="text"
                          variant="default"
                          value={facingThickness}
                          onChange={(e) => {
                            setFacingThickness(e.target.value)
                            clearFieldError('facing_thickness')
                          }}
                          error={fieldErrors.facing_thickness}
                        />
                      </div>
                      <div className="col-md-6">
                        <FloatingInput
                          label="Taper Details"
                          type="text"
                          variant="default"
                          value={taperDetails}
                          onChange={(e) => setTaperDetails(e.target.value)}
                        />
                      </div>
                      <div className="col-md-6">
                        <FloatingInput
                          label="Punch Border"
                          type="text"
                          variant="default"
                          value={punchBorder}
                          onChange={(e) => {
                            setPunchBorder(e.target.value)
                            clearFieldError('punch_border')
                          }}
                          error={fieldErrors.punch_border}
                        />
                      </div>
                      <div className="col-md-6">
                        <FloatingInput
                          label="Punch Deep"
                          type="text"
                          variant="default"
                          value={punchDeep}
                          onChange={(e) => setPunchDeep(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="hx-plan-card hx-plan-card--compact">
                    <div className="hx-plan-card__header">
                      <span className="hx-plan-card__title hx-plan-card__title--inline">
                        Task Assignment — {selectedTasks.length} / {taskSteps.length} selected
                      </span>
                      <button type="button" className="hx-plan-select-all" onClick={toggleAllTasks}>
                        {selectedTasks.length === taskSteps.length ? 'Clear All' : 'Select All'}
                      </button>
                    </div>
                    {fieldErrors.planning_tasks && (
                      <small className="hx-field-error hx-section-error">{fieldErrors.planning_tasks}</small>
                    )}
                    <div className={`hx-plan-tasks${fieldErrors.planning_tasks ? ' hx-plan-tasks--invalid' : ''}`}>
                      {taskSteps.map((step, i) => (
                        <label key={step} className="hx-plan-task-row">
                          <input type="checkbox" checked={selectedTasks.includes(step)} onChange={() => toggleTask(step)} />
                          <span className="hx-plan-task-row__index">{String(i + 1).padStart(2, '0')}</span>
                          <span className="hx-plan-task-row__name">{step}</span>
                          {selectedTasks.includes(step) && <span className="hx-status-pill hx-status-pill--planned">Assigned</span>}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="hx-plan-card hx-plan-card--compact">
                    {order.remarks && (
                      <div className="hx-plan-subsection">
                        <span className="hx-plan-card__title">Order Remarks</span>
                        <p className="hx-detail-grid__value m-0">{order.remarks}</p>
                      </div>
                    )}

                    <div className="hx-plan-subsection">
                      <span className="hx-plan-card__title">Planning Remarks</span>
                      <textarea
                        className="form-control hx-plan-remarks"
                        rows={3}
                        placeholder="Planning notes…"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="button-group d-flex justify-content-center pt-10">
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
