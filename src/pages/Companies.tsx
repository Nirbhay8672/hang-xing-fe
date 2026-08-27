import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import { FloatingInput, FloatingSelect } from '../components/FloatingField'
import '../components/detailView.css'
import '../components/formStyles.css'
import '../components/iconButtons.css'
import type { Company, ManufacturingSpecificationInput } from '../companies/types'
import { companiesService } from '../companies/companiesService'
import type { Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import './Companies.css'

interface CompanyFormState {
  name: string
  address: string
  director_name: string
  director_contact: string
  manufacturing_specifications: ManufacturingSpecificationInput[]
}

const EMPTY_SPEC: ManufacturingSpecificationInput = {
  size: '',
  greentile_thick: '',
  upper_punch: '',
  up_master_no: '',
  lower_punch: '',
  lp_master_no: '',
  cavity: '',
}

const EMPTY_FORM: CompanyFormState = {
  name: '',
  address: '',
  director_name: '',
  director_contact: '',
  manufacturing_specifications: [{ ...EMPTY_SPEC }],
}

const SIZE_OPTIONS = [
  '150 x 150',
  '150 x 900',
  '200 x 200',
  '200 x 300',
  '200 x 600',
  '300 x 300',
  '300 x 450',
  '300 x 600',
  '300 x 900',
  '300 x 1200',
  '400 x 400',
  '400 x 800',
  '400 x 1200',
  '450 x 450',
  '450 x 900',
  '500 x 500',
  '600 x 600',
  '600 x 900',
  '600 x 1000',
  '600 x 1200',
  '600 x 1520',
  '750 x 1400',
  '750 x 1500',
  '800 x 800',
  '800 x 1200',
  '800 x 1600',
  '800 x 1800',
  '800 x 2400',
  '800 x 2600',
  '900 x 1800',
  '1000 x 1000',
  '1000 x 2000',
  '1200 x 1200',
  '1200 x 1800',
  '1200 x 2400',
]

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

export default function Companies() {
  const { can } = useAuth()
  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [specsTarget, setSpecsTarget] = useState<Company | null>(null)

  const [viewTarget, setViewTarget] = useState<Company | null>(null)
  const [viewOrders, setViewOrders] = useState<Order[] | null>(null)
  const [viewOrdersError, setViewOrdersError] = useState<string | null>(null)

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null)
  const [editFetchError, setEditFetchError] = useState<string | null>(null)
  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadCompanies()
  }, [])

  async function loadCompanies() {
    setLoadError(null)
    try {
      const data = await companiesService.list()
      setCompanies(data)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load companies.')
    }
  }

  function companyToForm(company: Company): CompanyFormState {
    return {
      name: company.name,
      address: company.address,
      director_name: company.director_name,
      director_contact: company.director_contact,
      manufacturing_specifications: company.manufacturing_specifications.length
        ? company.manufacturing_specifications.map((spec) => ({
            size: spec.size,
            greentile_thick: spec.greentile_thick,
            upper_punch: spec.upper_punch,
            up_master_no: spec.up_master_no,
            lower_punch: spec.lower_punch,
            lp_master_no: spec.lp_master_no,
            cavity: spec.cavity,
          }))
        : [{ ...EMPTY_SPEC }],
    }
  }

  function openViewModal(company: Company) {
    setViewTarget(company)
    setViewOrders(null)
    setViewOrdersError(null)
    ordersService
      .list()
      .then((orders) => setViewOrders(orders.filter((o) => o.company_id === company.id)))
      .catch((err) => setViewOrdersError(err instanceof ApiError ? err.message : 'Failed to load related orders.'))
  }

  function closeViewModal() {
    setViewTarget(null)
    setViewOrders(null)
    setViewOrdersError(null)
  }

  function openCreateModal() {
    setEditingCompany(null)
    setForm({ ...EMPTY_FORM, manufacturing_specifications: [{ ...EMPTY_SPEC }] })
    setFormErrors({})
    setModalMode('create')
  }

  async function openEditModal(company: Company) {
    setEditFetchError(null)
    setEditLoadingId(company.id)
    try {
      const fresh = await companiesService.get(company.id)
      setEditingCompany(fresh)
      setForm(companyToForm(fresh))
      setFormErrors({})
      setModalMode('edit')
    } catch (err) {
      setEditFetchError(err instanceof ApiError ? err.message : 'Failed to load company.')
    } finally {
      setEditLoadingId(null)
    }
  }

  function closeModal() {
    if (submitting) return
    setModalMode(null)
  }

  function openDeleteModal(company: Company) {
    setDeleteTarget(company)
    setDeleteError(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await companiesService.remove(deleteTarget.id)
      setCompanies((prev) => prev?.filter((c) => c.id !== deleteTarget.id) ?? null)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete company.')
    } finally {
      setDeleting(false)
    }
  }

  function addSpecRow() {
    setForm((f) => ({
      ...f,
      manufacturing_specifications: [...f.manufacturing_specifications, { ...EMPTY_SPEC }],
    }))
  }

  function removeSpecRow(index: number) {
    setForm((f) => ({
      ...f,
      manufacturing_specifications: f.manufacturing_specifications.filter((_, i) => i !== index),
    }))
  }

  function updateSpecField(index: number, field: keyof ManufacturingSpecificationInput, value: string) {
    setForm((f) => ({
      ...f,
      manufacturing_specifications: f.manufacturing_specifications.map((spec, i) =>
        i === index ? { ...spec, [field]: value } : spec,
      ),
    }))
  }

  function specError(index: number, field: keyof ManufacturingSpecificationInput): string | undefined {
    return formErrors[`manufacturing_specifications.${index}.${field}`]?.[0]
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormErrors({})
    try {
      const specs = form.manufacturing_specifications.filter((spec) =>
        Object.values(spec).some((value) => value.trim() !== ''),
      )
      const payload = {
        name: form.name,
        address: form.address,
        director_name: form.director_name,
        director_contact: form.director_contact,
        manufacturing_specifications: specs,
      }
      if (modalMode === 'edit' && editingCompany) {
        const updated = await companiesService.update(editingCompany.id, payload)
        setCompanies((prev) => prev?.map((c) => (c.id === updated.id ? updated : c)) ?? null)
      } else {
        const created = await companiesService.create(payload)
        setCompanies((prev) => (prev ? [created, ...prev] : [created]))
      }
      setModalMode(null)
    } catch (err) {
      setFormErrors(extractErrors(err, 'Something went wrong. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const filteredCompanies = companies?.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q) ||
      c.director_name.toLowerCase().includes(q)
    )
  })

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
              placeholder="Search by name, address, or director"
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
    <AppShell title="Companies" actions={headerActions}>
      <div className="row">
        <div className="col-12">
          <div className="contact-list-wrap mb-25">
            <div className="contact-list bg-white radius-xl w-100">
              {loadError && <p className="hx-form-error m-20">{loadError}</p>}
              {editFetchError && <p className="hx-form-error m-20">{editFetchError}</p>}
              {companies === null && !loadError && <p className="hx-companies-empty">Loading companies…</p>}
              {filteredCompanies && filteredCompanies.length === 0 && (
                <p className="hx-companies-empty">No companies found.</p>
              )}

              {filteredCompanies && filteredCompanies.length > 0 && (
                <div className="table-responsive">
                  <table className="table mb-0 table-borderless table-rounded">
                    <thead>
                      <tr>
                        <th>
                          <span className="userDatatable-title">Name</span>
                        </th>
                        <th>
                          <span>Address</span>
                        </th>
                        <th>
                          <span>Director</span>
                        </th>
                        <th>
                          <span>Contact</span>
                        </th>
                        <th>
                          <span>Created</span>
                        </th>
                        <th>
                          <span>Specifications</span>
                        </th>
                        <th className="c-action">
                          <span className="float-right"></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <span className="position">{c.name}</span>
                          </td>
                          <td>
                            <span className="position">{c.address}</span>
                          </td>
                          <td>
                            <span className="position">{c.director_name}</span>
                          </td>
                          <td>
                            <span className="position">{c.director_contact}</span>
                          </td>
                          <td>
                            <span className="position">{formatDate(c.created_at)}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="hx-specs-badge"
                              disabled={c.manufacturing_specifications.length === 0}
                              onClick={() => setSpecsTarget(c)}
                            >
                              {c.manufacturing_specifications.length} spec
                              {c.manufacturing_specifications.length === 1 ? '' : 's'}
                            </button>
                          </td>
                          <td>
                            <div className="table-actions d-flex">
                              <button
                                type="button"
                                className="hx-icon-btn hx-icon-btn--view"
                                aria-label="View company"
                                title="View"
                                onClick={() => openViewModal(c)}
                              >
                                <i className="la la-eye"></i>
                              </button>
                              {can('edit companies') && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--edit"
                                  aria-label="Edit company"
                                  title="Edit"
                                  disabled={editLoadingId === c.id}
                                  onClick={() => openEditModal(c)}
                                >
                                  <i className={editLoadingId === c.id ? 'la la-spinner la-spin' : 'la la-edit'}></i>
                                </button>
                              )}
                              {can('delete companies') && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--delete"
                                  aria-label="Delete company"
                                  title="Delete"
                                  onClick={() => openDeleteModal(c)}
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
            <div className="modal-dialog modal-dialog-centered modal-xl hx-modal-wide">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">{modalMode === 'create' ? 'Add New Company' : 'Edit Company'}</h6>
                  <button type="button" className="btn-close" onClick={closeModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="add-new-contact">
                    <form onSubmit={handleSubmit} autoComplete="off">
                      {formErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{formErrors[GENERAL_ERROR_KEY][0]}</p>}

                      <div className="row">
                        <div className="col-md-6">
                          <FloatingInput
                            label="Company Name"
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            required
                            error={formErrors.name?.[0]}
                          />
                        </div>
                        <div className="col-md-6">
                          <FloatingInput
                            label="Address"
                            type="text"
                            value={form.address}
                            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                            required
                            error={formErrors.address?.[0]}
                          />
                        </div>
                        <div className="col-md-6">
                          <FloatingInput
                            label="Director Name"
                            type="text"
                            value={form.director_name}
                            onChange={(e) => setForm((f) => ({ ...f, director_name: e.target.value }))}
                            required
                            error={formErrors.director_name?.[0]}
                          />
                        </div>
                        <div className="col-md-6">
                          <FloatingInput
                            label="Director Contact"
                            type="text"
                            value={form.director_contact}
                            onChange={(e) => setForm((f) => ({ ...f, director_contact: e.target.value }))}
                            required
                            error={formErrors.director_contact?.[0]}
                          />
                        </div>
                      </div>

                      <div className="hx-specs-section">
                        <div className="hx-specs-section__header">
                          <label className="mb-0">Manufacturing Specifications:</label>
                          <button type="button" className="hx-specs-add-btn" onClick={addSpecRow}>
                            <i className="la la-plus"></i> Add Specification
                          </button>
                        </div>

                        {form.manufacturing_specifications.length === 0 && (
                          <p className="hx-companies-empty">No specifications added.</p>
                        )}

                        {form.manufacturing_specifications.map((spec, index) => (
                          <div className="hx-spec-row" key={index}>
                            <div className="hx-spec-row__header">
                              <span className="hx-spec-row__title">Specification {index + 1}</span>
                              <button
                                type="button"
                                className="hx-icon-btn hx-icon-btn--delete"
                                aria-label="Remove specification"
                                title="Remove"
                                onClick={() => removeSpecRow(index)}
                              >
                                <i className="la la-trash"></i>
                              </button>
                            </div>
                            <div className="hx-spec-row__fields">
                              <FloatingSelect
                                label="Size"
                                variant="default"
                                wrapperClassName="mb-0"
                                value={spec.size}
                                onChange={(e) => updateSpecField(index, 'size', e.target.value)}
                                error={specError(index, 'size')}
                              >
                                <option value="">— Select —</option>
                                {SIZE_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </FloatingSelect>
                              <FloatingInput
                                label="Greentile Thick"
                                type="text"
                                variant="default"
                                wrapperClassName="mb-0"
                                value={spec.greentile_thick}
                                onChange={(e) => updateSpecField(index, 'greentile_thick', e.target.value)}
                                error={specError(index, 'greentile_thick')}
                              />
                              <FloatingInput
                                label="Upper Punch"
                                type="text"
                                variant="default"
                                wrapperClassName="mb-0"
                                value={spec.upper_punch}
                                onChange={(e) => updateSpecField(index, 'upper_punch', e.target.value)}
                                error={specError(index, 'upper_punch')}
                              />
                              <FloatingInput
                                label="Up Master No."
                                type="text"
                                variant="default"
                                wrapperClassName="mb-0"
                                value={spec.up_master_no}
                                onChange={(e) => updateSpecField(index, 'up_master_no', e.target.value)}
                                error={specError(index, 'up_master_no')}
                              />
                              <FloatingInput
                                label="Lower Punch"
                                type="text"
                                variant="default"
                                wrapperClassName="mb-0"
                                value={spec.lower_punch}
                                onChange={(e) => updateSpecField(index, 'lower_punch', e.target.value)}
                                error={specError(index, 'lower_punch')}
                              />
                              <FloatingInput
                                label="LP Master No."
                                type="text"
                                variant="default"
                                wrapperClassName="mb-0"
                                value={spec.lp_master_no}
                                onChange={(e) => updateSpecField(index, 'lp_master_no', e.target.value)}
                                error={specError(index, 'lp_master_no')}
                              />
                              <FloatingInput
                                label="Cavity"
                                type="text"
                                variant="default"
                                wrapperClassName="mb-0"
                                value={spec.cavity}
                                onChange={(e) => updateSpecField(index, 'cavity', e.target.value)}
                                error={specError(index, 'cavity')}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="button-group d-flex justify-content-center pt-20">
                        <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded me-10" onClick={closeModal} disabled={submitting}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-sm btn-primary btn-rounded" disabled={submitting}>
                          {submitting ? 'Saving…' : modalMode === 'create' ? 'Add New Company' : 'Save Changes'}
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
            <div className="modal-dialog modal-dialog-centered modal-xl">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Company Details</h6>
                  <button type="button" className="btn-close" onClick={closeViewModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Company</span>
                    <div className="hx-detail-grid">
                      <div>
                        <span className="hx-detail-grid__label">Name</span>
                        <span className="hx-detail-grid__value">{viewTarget.name}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Director Name</span>
                        <span className="hx-detail-grid__value">{viewTarget.director_name}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Director Contact</span>
                        <span className="hx-detail-grid__value">{viewTarget.director_contact}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Created</span>
                        <span className="hx-detail-grid__value">{formatDate(viewTarget.created_at)}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Last Updated</span>
                        <span className="hx-detail-grid__value">{formatDate(viewTarget.updated_at)}</span>
                      </div>
                      <div className="hx-detail-grid__full">
                        <span className="hx-detail-grid__label">Address</span>
                        <span className="hx-detail-grid__value">{viewTarget.address}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Manufacturing Specifications</span>
                    {viewTarget.manufacturing_specifications.length === 0 ? (
                      <p className="hx-companies-empty">No specifications added.</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table mb-0 table-borderless table-rounded">
                          <thead>
                            <tr>
                              <th>
                                <span>Size</span>
                              </th>
                              <th>
                                <span>Greentile Thick</span>
                              </th>
                              <th>
                                <span>Upper Punch</span>
                              </th>
                              <th>
                                <span>Up Master No.</span>
                              </th>
                              <th>
                                <span>Lower Punch</span>
                              </th>
                              <th>
                                <span>LP Master No.</span>
                              </th>
                              <th>
                                <span>Cavity</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewTarget.manufacturing_specifications.map((spec) => (
                              <tr key={spec.id}>
                                <td>{spec.size}</td>
                                <td>{spec.greentile_thick}</td>
                                <td>{spec.upper_punch}</td>
                                <td>{spec.up_master_no}</td>
                                <td>{spec.lower_punch}</td>
                                <td>{spec.lp_master_no}</td>
                                <td>{spec.cavity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Related Orders</span>
                    {viewOrdersError && <p className="hx-form-error">{viewOrdersError}</p>}
                    {viewOrders === null && !viewOrdersError && <p className="hx-companies-empty">Loading orders…</p>}
                    {viewOrders && viewOrders.length === 0 && (
                      <p className="hx-companies-empty">No orders found for this company.</p>
                    )}
                    {viewOrders && viewOrders.length > 0 && (
                      <div className="table-responsive">
                        <table className="table mb-0 table-borderless table-rounded">
                          <thead>
                            <tr>
                              <th>
                                <span>Order No.</span>
                              </th>
                              <th>
                                <span>Size</span>
                              </th>
                              <th>
                                <span>Punch Type</span>
                              </th>
                              <th>
                                <span>Qty</span>
                              </th>
                              <th>
                                <span>Delivery</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewOrders.map((o) => (
                              <tr key={o.id}>
                                <td>{o.order_no}</td>
                                <td>{o.size}</td>
                                <td>
                                  <span className="hx-order-badge">{o.punch_type}</span>
                                </td>
                                <td>{o.quantity}</td>
                                <td>{o.expected_delivery_date ? formatDate(o.expected_delivery_date) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="button-group d-flex justify-content-center pt-20">
                    <button type="button" className="btn btn-sm hx-btn-secondary btn-rounded" onClick={closeViewModal}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeViewModal}></div>
        </>
      )}

      {specsTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">{specsTarget.name} — Manufacturing Specifications</h6>
                  <button type="button" className="btn-close" onClick={() => setSpecsTarget(null)} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="table-responsive">
                    <table className="table mb-0 table-borderless table-rounded">
                      <thead>
                        <tr>
                          <th>
                            <span>Size</span>
                          </th>
                          <th>
                            <span>Greentile Thick</span>
                          </th>
                          <th>
                            <span>Upper Punch</span>
                          </th>
                          <th>
                            <span>Up Master No.</span>
                          </th>
                          <th>
                            <span>Lower Punch</span>
                          </th>
                          <th>
                            <span>LP Master No.</span>
                          </th>
                          <th>
                            <span>Cavity</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {specsTarget.manufacturing_specifications.map((spec) => (
                          <tr key={spec.id}>
                            <td>{spec.size}</td>
                            <td>{spec.greentile_thick}</td>
                            <td>{spec.upper_punch}</td>
                            <td>{spec.up_master_no}</td>
                            <td>{spec.lower_punch}</td>
                            <td>{spec.lp_master_no}</td>
                            <td>{spec.cavity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setSpecsTarget(null)}></div>
        </>
      )}

      {deleteTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Delete company?</h6>
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
                    This will permanently delete <strong>{deleteTarget.name}</strong> and its manufacturing
                    specifications. This cannot be undone.
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
