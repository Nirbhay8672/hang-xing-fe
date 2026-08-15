import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import { FloatingInput, FloatingSelect, FloatingTextarea } from '../components/FloatingField'
import '../components/detailView.css'
import '../components/formStyles.css'
import '../components/iconButtons.css'
import type { Company, ManufacturingSpecification } from '../companies/types'
import { companiesService } from '../companies/companiesService'
import type { CreateOrderRequest, Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import type { User } from '../users/types'
import { usersService } from '../users/usersService'
import './Orders.css'

type SortField = 'order_no' | 'company' | 'size' | 'created_at' | 'expected_delivery_date'
type SortDir = 'asc' | 'desc'

function sortValue(order: Order, field: SortField): string | number | null {
  switch (field) {
    case 'order_no':
      return order.order_no ?? ''
    case 'company':
      return order.company?.name ?? ''
    case 'size':
      return order.size ?? ''
    case 'created_at':
      return new Date(order.created_at).getTime()
    case 'expected_delivery_date':
      return order.expected_delivery_date ? new Date(order.expected_delivery_date).getTime() : null
  }
}

function sortOrders(list: Order[], field: SortField | null, dir: SortDir): Order[] {
  if (!field) return list
  const factor = dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    const va = sortValue(a, field)
    const vb = sortValue(b, field)
    // Orders without a delivery date always sink to the bottom, regardless of direction.
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
    return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * factor
  })
}

const ORDER_TYPE_OPTIONS = ['New', 'RC']
const PUNCH_TYPE_OPTIONS = [
  'U - ISO',
  'U - N ISO',
  'U - PLAIN',
  'U - RUSTIC',
  'L - ISO',
  'L - N ISO',
  'L - PLAIN',
  'L - RUSTIC',
]

interface OrderFormState {
  company_id: string
  size: string
  punch_type: string
  order_type: string
  quantity: string
  user_id: string
  expected_delivery_date: string
  master_number: string
  remarks: string
}

const EMPTY_FORM: OrderFormState = {
  company_id: '',
  size: '',
  punch_type: '',
  order_type: '',
  quantity: '1',
  user_id: '',
  expected_delivery_date: '',
  master_number: '',
  remarks: '',
}

const GENERAL_ERROR_KEY = '_general'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function extractErrors(error: unknown, fallback: string): Record<string, string[]> {
  if (error instanceof ApiError) {
    if (error.body?.errors) return error.body.errors
    return { [GENERAL_ERROR_KEY]: [error.body?.message ?? fallback] }
  }
  return { [GENERAL_ERROR_KEY]: [fallback] }
}

export default function Orders() {
  const { can } = useAuth()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<User[]>([])

  const [viewTarget, setViewTarget] = useState<Order | null>(null)
  const [viewLoadingId, setViewLoadingId] = useState<number | null>(null)
  const [viewFetchError, setViewFetchError] = useState<string | null>(null)

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null)
  const [editFetchError, setEditFetchError] = useState<string | null>(null)
  const [form, setForm] = useState<OrderFormState>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadOrders()
    companiesService.list().then(setCompanies).catch(() => setCompanies([]))
    usersService.list().then(setUsers).catch(() => setUsers([]))
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

  const selectedCompany = companies.find((c) => c.id === Number(form.company_id)) ?? null
  const selectedSpec: ManufacturingSpecification | null =
    selectedCompany?.manufacturing_specifications.find((spec) => spec.size === form.size) ?? null

  function orderToForm(order: Order): OrderFormState {
    return {
      company_id: String(order.company_id),
      size: order.size,
      punch_type: order.punch_type,
      order_type: order.order_type,
      quantity: String(order.quantity),
      user_id: String(order.user_id),
      expected_delivery_date: order.expected_delivery_date?.slice(0, 10) ?? '',
      master_number: order.master_number,
      remarks: order.remarks ?? '',
    }
  }

  function openCreateModal() {
    setEditingOrder(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setModalMode('create')
  }

  async function openViewModal(order: Order) {
    setViewFetchError(null)
    setViewLoadingId(order.id)
    try {
      const fresh = await ordersService.get(order.id)
      setViewTarget(fresh)
    } catch (err) {
      setViewFetchError(err instanceof ApiError ? err.message : 'Failed to load order.')
    } finally {
      setViewLoadingId(null)
    }
  }

  async function openEditModal(order: Order) {
    setEditFetchError(null)
    setEditLoadingId(order.id)
    try {
      const fresh = await ordersService.get(order.id)
      setEditingOrder(fresh)
      setForm(orderToForm(fresh))
      setFormErrors({})
      setModalMode('edit')
    } catch (err) {
      setEditFetchError(err instanceof ApiError ? err.message : 'Failed to load order.')
    } finally {
      setEditLoadingId(null)
    }
  }

  function closeModal() {
    if (submitting) return
    setModalMode(null)
  }

  function openDeleteModal(order: Order) {
    setDeleteTarget(order)
    setDeleteError(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await ordersService.remove(deleteTarget.id)
      setOrders((prev) => prev?.filter((o) => o.id !== deleteTarget.id) ?? null)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete order.')
    } finally {
      setDeleting(false)
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function handleCompanyChange(companyId: string) {
    setForm((f) => ({ ...f, company_id: companyId, size: '', master_number: '' }))
  }

  function handleSizeChange(size: string) {
    const spec = selectedCompany?.manufacturing_specifications.find((s) => s.size === size) ?? null
    setForm((f) => ({ ...f, size, master_number: spec?.master_no ?? f.master_number }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormErrors({})
    try {
      const payload: CreateOrderRequest = {
        company_id: Number(form.company_id),
        user_id: Number(form.user_id),
        size: form.size,
        punch_type: form.punch_type,
        order_type: form.order_type,
        quantity: Number(form.quantity),
        expected_delivery_date: form.expected_delivery_date,
        master_number: form.master_number,
        remarks: form.remarks || undefined,
      }
      if (modalMode === 'edit' && editingOrder) {
        const updated = await ordersService.update(editingOrder.id, payload)
        setOrders((prev) => prev?.map((o) => (o.id === updated.id ? updated : o)) ?? null)
      } else {
        const created = await ordersService.create(payload)
        setOrders((prev) => (prev ? [created, ...prev] : [created]))
      }
      setModalMode(null)
    } catch (err) {
      setFormErrors(extractErrors(err, 'Something went wrong. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const searchedOrders = orders?.filter((o) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      o.order_no?.toLowerCase().includes(q) ||
      o.company?.name.toLowerCase().includes(q) ||
      o.master_number?.toLowerCase().includes(q)
    )
  })
  const filteredOrders = searchedOrders && sortOrders(searchedOrders, sortField, sortDir)

  function sortIconClass(field: SortField): string {
    if (sortField !== field) return 'la la-sort hx-sort-icon'
    return sortDir === 'asc' ? 'la la-sort-up hx-sort-icon hx-sort-icon--active' : 'la la-sort-down hx-sort-icon hx-sort-icon--active'
  }

  const headerActions = (
    <>
      <div className="action-btn">
        <div className="form-group mb-0">
          <div className="input-container icon-left position-relative">
            <span className="input-icon icon-left">
              <i className="la la-search"></i>
            </span>
            <input
              type="text"
              className="form-control form-control-default"
              placeholder="Search by order no, company, or master number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="action-btn">
        <button type="button" className="btn btn-sm btn-primary btn-add" onClick={openCreateModal} aria-label="Add New">
          <i className="la la-plus"></i>
        </button>
      </div>
    </>
  )

  return (
    <AppShell title="Orders" actions={headerActions}>
      <div className="row">
        <div className="col-12">
          <div className="contact-list-wrap mb-25">
            <div className="contact-list bg-white radius-xl w-100">
              {loadError && <p className="hx-form-error m-20">{loadError}</p>}
              {editFetchError && <p className="hx-form-error m-20">{editFetchError}</p>}
              {viewFetchError && <p className="hx-form-error m-20">{viewFetchError}</p>}
              {orders === null && !loadError && <p className="hx-orders-empty">Loading orders…</p>}
              {filteredOrders && filteredOrders.length === 0 && <p className="hx-orders-empty">No orders found.</p>}

              {filteredOrders && filteredOrders.length > 0 && (
                <div className="table-responsive">
                  <table className="table mb-0 table-borderless table-rounded">
                    <thead>
                      <tr>
                        <th>
                          <button type="button" className="hx-sort-th" onClick={() => handleSort('order_no')}>
                            <span className="userDatatable-title">Order No.</span>
                            <i className={sortIconClass('order_no')}></i>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="hx-sort-th" onClick={() => handleSort('company')}>
                            <span>Company</span>
                            <i className={sortIconClass('company')}></i>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="hx-sort-th" onClick={() => handleSort('size')}>
                            <span>Size</span>
                            <i className={sortIconClass('size')}></i>
                          </button>
                        </th>
                        <th>
                          <span>Punch Type</span>
                        </th>
                        <th>
                          <span>Order Type</span>
                        </th>
                        <th>
                          <span>Qty</span>
                        </th>
                        <th>
                          <span>Order By</span>
                        </th>
                        <th>
                          <button type="button" className="hx-sort-th" onClick={() => handleSort('expected_delivery_date')}>
                            <span>Delivery</span>
                            <i className={sortIconClass('expected_delivery_date')}></i>
                          </button>
                        </th>
                        <th>
                          <button type="button" className="hx-sort-th" onClick={() => handleSort('created_at')}>
                            <span>Created</span>
                            <i className={sortIconClass('created_at')}></i>
                          </button>
                        </th>
                        <th className="c-action">
                          <span className="float-right"></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => (
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
                            <span className="hx-order-badge">{o.punch_type}</span>
                          </td>
                          <td>
                            <span className="hx-order-badge">{o.order_type}</span>
                          </td>
                          <td>
                            <span className="position">{o.quantity}</span>
                          </td>
                          <td>
                            <span className="position">{o.user?.name}</span>
                          </td>
                          <td>
                            <span className="position">
                              {o.expected_delivery_date ? formatDate(o.expected_delivery_date) : '—'}
                            </span>
                          </td>
                          <td>
                            <span className="position">{formatDate(o.created_at)}</span>
                          </td>
                          <td>
                            <div className="table-actions d-flex">
                              <button
                                type="button"
                                className="hx-icon-btn hx-icon-btn--view"
                                aria-label="View order"
                                title="View"
                                disabled={viewLoadingId === o.id}
                                onClick={() => openViewModal(o)}
                              >
                                <i className={viewLoadingId === o.id ? 'la la-spinner la-spin' : 'la la-eye'}></i>
                              </button>
                              {can('edit orders') && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--edit"
                                  aria-label="Edit order"
                                  title="Edit"
                                  disabled={editLoadingId === o.id}
                                  onClick={() => openEditModal(o)}
                                >
                                  <i className={editLoadingId === o.id ? 'la la-spinner la-spin' : 'la la-edit'}></i>
                                </button>
                              )}
                              {can('delete orders') && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--delete"
                                  aria-label="Delete order"
                                  title="Delete"
                                  onClick={() => openDeleteModal(o)}
                                >
                                  <i className="la la-trash"></i>
                                </button>
                              )}
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

      {modalMode && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-xl">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">{modalMode === 'create' ? 'New Order' : 'Edit Order'}</h6>
                  <button type="button" className="btn-close" onClick={closeModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="add-new-contact">
                    <form onSubmit={handleSubmit} autoComplete="off">
                      {formErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{formErrors[GENERAL_ERROR_KEY][0]}</p>}

                      <div className="hx-order-section">
                        <span className="hx-order-section__title">Order Details</span>
                        <div className="row">
                          <div className="col-md-6">
                            <FloatingSelect
                              label="Company"
                              value={form.company_id}
                              onChange={(e) => handleCompanyChange(e.target.value)}
                              required
                              error={formErrors.company_id?.[0]}
                            >
                              <option value="">— Select —</option>
                              {companies.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </FloatingSelect>
                          </div>
                          <div className="col-md-6">
                            <FloatingSelect
                              label="Size"
                              value={form.size}
                              onChange={(e) => handleSizeChange(e.target.value)}
                              disabled={!selectedCompany}
                              required
                              error={formErrors.size?.[0]}
                            >
                              <option value="">— Select —</option>
                              {selectedCompany?.manufacturing_specifications.map((spec) => (
                                <option key={spec.id} value={spec.size}>
                                  {spec.size}
                                </option>
                              ))}
                            </FloatingSelect>
                          </div>
                          <div className="col-md-6">
                            <FloatingSelect
                              label="Punch Type"
                              value={form.punch_type}
                              onChange={(e) => setForm((f) => ({ ...f, punch_type: e.target.value }))}
                              required
                              error={formErrors.punch_type?.[0]}
                            >
                              <option value="">— Select —</option>
                              {PUNCH_TYPE_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </FloatingSelect>
                          </div>
                          <div className="col-md-6">
                            <FloatingSelect
                              label="Order Type"
                              value={form.order_type}
                              onChange={(e) => setForm((f) => ({ ...f, order_type: e.target.value }))}
                              required
                              error={formErrors.order_type?.[0]}
                            >
                              <option value="">— Select —</option>
                              {ORDER_TYPE_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </FloatingSelect>
                          </div>
                        </div>
                      </div>

                      <div className="hx-order-section">
                        <span className="hx-order-section__title">Size Details (from company record)</span>
                        {selectedSpec ? (
                          <div className="hx-order-spec-grid">
                            <div>
                              <span className="hx-order-spec-grid__label">Greentile Thick</span>
                              <span className="hx-order-spec-grid__value">{selectedSpec.greentile_thick}</span>
                            </div>
                            <div>
                              <span className="hx-order-spec-grid__label">Upper Punch</span>
                              <span className="hx-order-spec-grid__value">{selectedSpec.upper_punch}</span>
                            </div>
                            <div>
                              <span className="hx-order-spec-grid__label">Lower Punch</span>
                              <span className="hx-order-spec-grid__value">{selectedSpec.lower_punch}</span>
                            </div>
                            <div>
                              <span className="hx-order-spec-grid__label">Cavity</span>
                              <span className="hx-order-spec-grid__value">{selectedSpec.cavity}</span>
                            </div>
                            <div>
                              <span className="hx-order-spec-grid__label">Master No.</span>
                              <span className="hx-order-spec-grid__value">{selectedSpec.master_no}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="hx-orders-empty">Select company and size above to auto-fill specifications.</p>
                        )}
                      </div>

                      <div className="hx-order-section">
                        <span className="hx-order-section__title">Quantity &amp; Assignment</span>
                        <div className="row">
                          <div className="col-md-6">
                            <FloatingInput
                              label="Quantity (pieces)"
                              type="number"
                              min={1}
                              value={form.quantity}
                              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                              required
                              error={formErrors.quantity?.[0]}
                            />
                          </div>
                          <div className="col-md-6">
                            <FloatingSelect
                              label="Order By"
                              value={form.user_id}
                              onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                              required
                              error={formErrors.user_id?.[0]}
                            >
                              <option value="">— Select —</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </FloatingSelect>
                          </div>
                          <div className="col-md-6">
                            <FloatingInput
                              label="Expected Delivery Date"
                              type="date"
                              value={form.expected_delivery_date}
                              onChange={(e) => setForm((f) => ({ ...f, expected_delivery_date: e.target.value }))}
                              required
                              error={formErrors.expected_delivery_date?.[0]}
                            />
                          </div>
                          <div className="col-md-6">
                            <FloatingInput
                              label="Master Number"
                              type="text"
                              value={form.master_number}
                              onChange={(e) => setForm((f) => ({ ...f, master_number: e.target.value }))}
                              required
                              error={formErrors.master_number?.[0]}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="hx-order-section">
                        <span className="hx-order-section__title">Remarks</span>
                        <FloatingTextarea
                          label="Additional notes"
                          rows={3}
                          value={form.remarks}
                          onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                          error={formErrors.remarks?.[0]}
                        />
                      </div>

                      <div className="button-group d-flex justify-content-center pt-20">
                        <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded me-10" onClick={closeModal} disabled={submitting}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-sm btn-primary btn-rounded" disabled={submitting}>
                          {submitting ? 'Saving…' : modalMode === 'create' ? 'Create Order' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeModal}></div>
        </>
      )}

      {viewTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Order Details</h6>
                  <button type="button" className="btn-close" onClick={() => setViewTarget(null)} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Order</span>
                    <div className="hx-detail-grid">
                      <div>
                        <span className="hx-detail-grid__label">Order No.</span>
                        <span className="hx-detail-grid__value">{viewTarget.order_no}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Company</span>
                        <span className="hx-detail-grid__value">{viewTarget.company?.name}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Size</span>
                        <span className="hx-detail-grid__value">{viewTarget.size}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Punch Type</span>
                        <span className="hx-detail-grid__value">{viewTarget.punch_type}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Order Type</span>
                        <span className="hx-detail-grid__value">{viewTarget.order_type}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Quantity</span>
                        <span className="hx-detail-grid__value">{viewTarget.quantity}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Order By</span>
                        <span className="hx-detail-grid__value">{viewTarget.user?.name}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Expected Delivery</span>
                        <span className="hx-detail-grid__value">
                          {viewTarget.expected_delivery_date ? formatDate(viewTarget.expected_delivery_date) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Master Number</span>
                        <span className="hx-detail-grid__value">{viewTarget.master_number}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Created</span>
                        <span className="hx-detail-grid__value">{formatDate(viewTarget.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {(viewTarget.punch_numbers ?? []).length > 0 && (
                    <div className="hx-detail-section">
                      <span className="hx-detail-section__title">Punch Numbers</span>
                      <div className="hx-order-badges">
                        {(viewTarget.punch_numbers ?? []).map((n) => (
                          <span key={n} className="hx-order-badge">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Remarks</span>
                    <span className="hx-detail-grid__value">{viewTarget.remarks || '—'}</span>
                  </div>

                  <div className="button-group d-flex justify-content-center pt-20">
                    <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded" onClick={() => setViewTarget(null)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setViewTarget(null)}></div>
        </>
      )}

      {deleteTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Delete order?</h6>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => !deleting && setDeleteTarget(null)}
                    aria-label="Close"
                  >
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <p>
                    This will permanently delete order <strong>{deleteTarget.order_no}</strong>. This cannot be undone.
                  </p>
                  {deleteError && <p className="hx-form-error">{deleteError}</p>}
                  <div className="button-group d-flex justify-content-center pt-20">
                    <button
                      type="button"
                      className="btn btn-sm hx-btn-secondary btn-rounded me-10"
                      onClick={() => setDeleteTarget(null)}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button type="button" className="btn btn-sm btn-danger btn-rounded" onClick={handleDelete} disabled={deleting}>
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => !deleting && setDeleteTarget(null)}></div>
        </>
      )}
    </AppShell>
  )
}
