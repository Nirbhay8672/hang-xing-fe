import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import AppShell from '../components/AppShell'
import { FloatingInput, FloatingSelect } from '../components/FloatingField'
import '../components/detailView.css'
import '../components/formStyles.css'
import '../components/iconButtons.css'
import Pagination from '../components/Pagination'
import { usePagination } from '../components/usePagination'
import type {
  Company,
  CompanyContractorInput,
  CompanyDirectorInput,
  CompanyPressInput,
  ManufacturingSpecificationInput,
} from '../companies/types'
import { companiesService } from '../companies/companiesService'
import type { Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import type { Size } from '../sizes/types'
import { sizesService } from '../sizes/sizesService'
import { sortSizes } from '../sizes/sortSizes'
import './Companies.css'
import './Orders.css'

interface CompanyFormState {
  name: string
  address: string
  directors: CompanyDirectorInput[]
  contractors: CompanyContractorInput[]
  presses: CompanyPressInput[]
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

const EMPTY_DIRECTOR: CompanyDirectorInput = { name: '', contact: '' }
const EMPTY_CONTRACTOR: CompanyContractorInput = { name: '', contact: '' }
const EMPTY_PRESS: CompanyPressInput = { name: '' }

const EMPTY_FORM: CompanyFormState = {
  name: '',
  address: '',
  directors: [{ ...EMPTY_DIRECTOR }],
  contractors: [{ ...EMPTY_CONTRACTOR }],
  presses: [{ ...EMPTY_PRESS }],
  manufacturing_specifications: [{ ...EMPTY_SPEC }],
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

export default function Companies() {
  const { can } = useAuth()
  const [companies, setCompanies] = useState<Company[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [specsTarget, setSpecsTarget] = useState<Company | null>(null)
  const [directorsTarget, setDirectorsTarget] = useState<Company | null>(null)
  const [contractorsTarget, setContractorsTarget] = useState<Company | null>(null)
  const [pressesTarget, setPressesTarget] = useState<Company | null>(null)

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

  const [sizes, setSizes] = useState<Size[]>([])
  const [sizeModalOpen, setSizeModalOpen] = useState(false)
  const [newSizeName, setNewSizeName] = useState('')
  const [newSizeSpecIndex, setNewSizeSpecIndex] = useState<number | null>(null)
  const [sizeError, setSizeError] = useState<string | null>(null)
  const [sizeSubmitting, setSizeSubmitting] = useState(false)

  useEffect(() => {
    loadCompanies()
    sizesService.list().then(setSizes).catch(() => setSizes([]))
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
      directors: company.directors.length
        ? company.directors.map((d) => ({ name: d.name, contact: d.contact }))
        : [{ ...EMPTY_DIRECTOR }],
      contractors: company.contractors.length
        ? company.contractors.map((c) => ({ name: c.name, contact: c.contact }))
        : [{ ...EMPTY_CONTRACTOR }],
      presses: company.presses.length ? company.presses.map((p) => ({ name: p.name })) : [{ ...EMPTY_PRESS }],
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
    setForm({
      ...EMPTY_FORM,
      directors: [{ ...EMPTY_DIRECTOR }],
      contractors: [{ ...EMPTY_CONTRACTOR }],
      presses: [{ ...EMPTY_PRESS }],
      manufacturing_specifications: [{ ...EMPTY_SPEC }],
    })
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

  function openAddSizeModal(specIndex: number) {
    setNewSizeName('')
    setSizeError(null)
    setNewSizeSpecIndex(specIndex)
    setSizeModalOpen(true)
  }

  function closeAddSizeModal() {
    if (sizeSubmitting) return
    setSizeModalOpen(false)
  }

  async function handleAddSize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSizeSubmitting(true)
    setSizeError(null)
    try {
      const created = await sizesService.create({ name: newSizeName })
      setSizes((prev) => sortSizes([...prev, created]))
      if (newSizeSpecIndex !== null) {
        updateSpecField(newSizeSpecIndex, 'size', created.name)
      }
      setSizeModalOpen(false)
    } catch (err) {
      setSizeError(err instanceof ApiError ? err.message : 'Failed to add size.')
    } finally {
      setSizeSubmitting(false)
    }
  }

  function addDirectorRow() {
    setForm((f) => ({ ...f, directors: [...f.directors, { ...EMPTY_DIRECTOR }] }))
  }

  function removeDirectorRow(index: number) {
    setForm((f) => ({ ...f, directors: f.directors.filter((_, i) => i !== index) }))
  }

  function updateDirectorField(index: number, field: keyof CompanyDirectorInput, value: string) {
    setForm((f) => ({
      ...f,
      directors: f.directors.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    }))
  }

  function directorError(index: number, field: keyof CompanyDirectorInput): string | undefined {
    return formErrors[`directors.${index}.${field}`]?.[0]
  }

  function addContractorRow() {
    setForm((f) => ({ ...f, contractors: [...f.contractors, { ...EMPTY_CONTRACTOR }] }))
  }

  function removeContractorRow(index: number) {
    setForm((f) => ({ ...f, contractors: f.contractors.filter((_, i) => i !== index) }))
  }

  function updateContractorField(index: number, field: keyof CompanyContractorInput, value: string) {
    setForm((f) => ({
      ...f,
      contractors: f.contractors.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }))
  }

  function contractorError(index: number, field: keyof CompanyContractorInput): string | undefined {
    return formErrors[`contractors.${index}.${field}`]?.[0]
  }

  function addPressRow() {
    setForm((f) => ({ ...f, presses: [...f.presses, { ...EMPTY_PRESS }] }))
  }

  function removePressRow(index: number) {
    setForm((f) => ({ ...f, presses: f.presses.filter((_, i) => i !== index) }))
  }

  function updatePressField(index: number, value: string) {
    setForm((f) => ({
      ...f,
      presses: f.presses.map((p, i) => (i === index ? { ...p, name: value } : p)),
    }))
  }

  function pressError(index: number): string | undefined {
    return formErrors[`presses.${index}.name`]?.[0]
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormErrors({})
    try {
      const specs = form.manufacturing_specifications.filter((spec) =>
        Object.values(spec).some((value) => value.trim() !== ''),
      )
      const directors = form.directors.filter((d) => Object.values(d).some((value) => value.trim() !== ''))
      const contractors = form.contractors.filter((c) => Object.values(c).some((value) => value.trim() !== ''))
      const presses = form.presses.filter((p) => p.name.trim() !== '')
      const payload = {
        name: form.name,
        address: form.address,
        directors,
        contractors,
        presses,
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
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q) ||
      c.directors.some((d) => d.name.toLowerCase().includes(q))
    const matchesSize = !sizeFilter || c.manufacturing_specifications.some((spec) => spec.size === sizeFilter)
    return matchesSearch && matchesSize
  })

  const {
    page: companiesPage,
    setPage: setCompaniesPage,
    totalPages: companiesTotalPages,
    totalItems: companiesTotalItems,
    perPage: companiesPerPage,
    pageItems: pagedCompanies,
  } = usePagination(filteredCompanies ?? [], 10)

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
        <div className="form-group mb-0">
          <select
            className="form-control form-control-default hx-size-filter"
            value={sizeFilter}
            onChange={(e) => setSizeFilter(e.target.value)}
            aria-label="Filter by size"
          >
            <option value="">All Sizes</option>
            {sizes.map((size) => (
              <option key={size.id} value={size.name}>
                {size.name}
              </option>
            ))}
          </select>
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
                          <span>Directors</span>
                        </th>
                        <th>
                          <span>Contractors</span>
                        </th>
                        <th>
                          <span>Press</span>
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
                      {pagedCompanies.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <span className="position">{c.name}</span>
                          </td>
                          <td>
                            <span className="position">{c.address}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="hx-specs-badge"
                              disabled={c.directors.length === 0}
                              onClick={() => setDirectorsTarget(c)}
                            >
                              {c.directors.length} director
                              {c.directors.length === 1 ? '' : 's'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="hx-specs-badge"
                              disabled={c.contractors.length === 0}
                              onClick={() => setContractorsTarget(c)}
                            >
                              {c.contractors.length} contractor
                              {c.contractors.length === 1 ? '' : 's'}
                            </button>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="hx-specs-badge"
                              disabled={c.presses.length === 0}
                              onClick={() => setPressesTarget(c)}
                            >
                              {c.presses.length} press
                              {c.presses.length === 1 ? '' : 'es'}
                            </button>
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
              <Pagination
                page={companiesPage}
                totalPages={companiesTotalPages}
                totalItems={companiesTotalItems}
                perPage={companiesPerPage}
                onPageChange={setCompaniesPage}
              />
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
                      </div>

                      <div className="hx-specs-section">
                        <div className="hx-specs-section__header">
                          <label className="mb-0">Directors:</label>
                          <button type="button" className="hx-specs-add-btn" onClick={addDirectorRow}>
                            <i className="la la-plus"></i> Add Director
                          </button>
                        </div>

                        {form.directors.length === 0 && <p className="hx-companies-empty">No directors added.</p>}

                        <div className="hx-inline-grid">
                          {form.directors.map((director, index) => {
                            // An entirely blank row (just added, not filled in yet) is allowed —
                            // it's dropped on submit. Once any field in the row has a value, Name
                            // becomes required, same as the row would need to be complete enough
                            // to actually get saved.
                            const rowHasValue = Object.values(director).some((value) => value.trim() !== '')
                            return (
                              <div className="hx-inline-row" key={index}>
                                <span className="hx-inline-row__label">Director {index + 1}</span>
                                <FloatingInput
                                  label="Name"
                                  type="text"
                                  variant="default"
                                  wrapperClassName="mb-0 hx-inline-row__field"
                                  value={director.name}
                                  onChange={(e) => updateDirectorField(index, 'name', e.target.value)}
                                  required={rowHasValue}
                                  error={directorError(index, 'name')}
                                />
                                <FloatingInput
                                  label="Contact"
                                  type="text"
                                  variant="default"
                                  wrapperClassName="mb-0 hx-inline-row__field"
                                  value={director.contact}
                                  onChange={(e) => updateDirectorField(index, 'contact', e.target.value)}
                                  error={directorError(index, 'contact')}
                                />
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--delete"
                                  aria-label="Remove director"
                                  title="Remove"
                                  onClick={() => removeDirectorRow(index)}
                                >
                                  <i className="la la-trash"></i>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="hx-specs-section">
                        <div className="hx-specs-section__header">
                          <label className="mb-0">Contractors:</label>
                          <button type="button" className="hx-specs-add-btn" onClick={addContractorRow}>
                            <i className="la la-plus"></i> Add Contractor
                          </button>
                        </div>

                        {form.contractors.length === 0 && <p className="hx-companies-empty">No contractors added.</p>}

                        <div className="hx-inline-grid">
                          {form.contractors.map((contractor, index) => {
                            const rowHasValue = Object.values(contractor).some((value) => value.trim() !== '')
                            return (
                              <div className="hx-inline-row" key={index}>
                                <span className="hx-inline-row__label">Contractor {index + 1}</span>
                                <FloatingInput
                                  label="Name"
                                  type="text"
                                  variant="default"
                                  wrapperClassName="mb-0 hx-inline-row__field"
                                  value={contractor.name}
                                  onChange={(e) => updateContractorField(index, 'name', e.target.value)}
                                  required={rowHasValue}
                                  error={contractorError(index, 'name')}
                                />
                                <FloatingInput
                                  label="Contact"
                                  type="text"
                                  variant="default"
                                  wrapperClassName="mb-0 hx-inline-row__field"
                                  value={contractor.contact}
                                  onChange={(e) => updateContractorField(index, 'contact', e.target.value)}
                                  error={contractorError(index, 'contact')}
                                />
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--delete"
                                  aria-label="Remove contractor"
                                  title="Remove"
                                  onClick={() => removeContractorRow(index)}
                                >
                                  <i className="la la-trash"></i>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="hx-specs-section">
                        <div className="hx-specs-section__header">
                          <label className="mb-0">Press:</label>
                          <button type="button" className="hx-specs-add-btn" onClick={addPressRow}>
                            <i className="la la-plus"></i> Add Press
                          </button>
                        </div>

                        {form.presses.length === 0 && <p className="hx-companies-empty">No press added.</p>}

                        <div className="hx-inline-grid">
                          {form.presses.map((press, index) => (
                            <div className="hx-inline-row" key={index}>
                              <span className="hx-inline-row__label">Press {index + 1}</span>
                              <FloatingInput
                                label="Press"
                                type="text"
                                variant="default"
                                wrapperClassName="mb-0 hx-inline-row__field"
                                value={press.name}
                                onChange={(e) => updatePressField(index, e.target.value)}
                                error={pressError(index)}
                              />
                              <button
                                type="button"
                                className="hx-icon-btn hx-icon-btn--delete"
                                aria-label="Remove press"
                                title="Remove"
                                onClick={() => removePressRow(index)}
                              >
                                <i className="la la-trash"></i>
                              </button>
                            </div>
                          ))}
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

                        {form.manufacturing_specifications.map((spec, index) => {
                          // An entirely blank row (just added, not filled in yet) is allowed —
                          // it's dropped on submit. Once any field in the row has a value,
                          // Size becomes required, same as the row would need to be complete
                          // enough to actually get saved.
                          const rowHasValue = Object.values(spec).some((value) => value.trim() !== '')
                          return (
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
                              <div className="hx-size-field">
                                <FloatingSelect
                                  label="Size"
                                  variant="default"
                                  wrapperClassName="mb-0"
                                  value={spec.size}
                                  onChange={(e) => updateSpecField(index, 'size', e.target.value)}
                                  required={rowHasValue}
                                  error={specError(index, 'size')}
                                >
                                  <option value="">— Select —</option>
                                  {sizes.map((opt) => (
                                    <option key={opt.id} value={opt.name}>
                                      {opt.name}
                                    </option>
                                  ))}
                                </FloatingSelect>
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--edit hx-size-field__add"
                                  aria-label="Add new size"
                                  title="Add New Size"
                                  onClick={() => openAddSizeModal(index)}
                                >
                                  <i className="la la-plus"></i>
                                </button>
                              </div>
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
                          )
                        })}
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

      {sizeModalOpen && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Add New Size</h6>
                  <button type="button" className="btn-close" onClick={closeAddSizeModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleAddSize} autoComplete="off">
                    {sizeError && <p className="hx-form-error">{sizeError}</p>}
                    <FloatingInput
                      label="Size (e.g. 600 x 1200)"
                      type="text"
                      value={newSizeName}
                      onChange={(e) => setNewSizeName(e.target.value)}
                      required
                      autoFocus
                    />
                    <div className="button-group d-flex justify-content-center pt-20">
                      <button
                        type="button"
                        className="btn btn-sm hx-btn-secondary btn-rounded me-10"
                        onClick={closeAddSizeModal}
                        disabled={sizeSubmitting}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-sm btn-primary btn-rounded" disabled={sizeSubmitting}>
                        {sizeSubmitting ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeAddSizeModal}></div>
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
                    <span className="hx-detail-section__title">Directors</span>
                    {viewTarget.directors.length === 0 ? (
                      <p className="hx-companies-empty">No directors added.</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table mb-0 table-borderless table-rounded">
                          <thead>
                            <tr>
                              <th>
                                <span>Name</span>
                              </th>
                              <th>
                                <span>Contact</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewTarget.directors.map((director) => (
                              <tr key={director.id}>
                                <td>{director.name}</td>
                                <td>{director.contact}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Contractors</span>
                    {viewTarget.contractors.length === 0 ? (
                      <p className="hx-companies-empty">No contractors added.</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table mb-0 table-borderless table-rounded">
                          <thead>
                            <tr>
                              <th>
                                <span>Name</span>
                              </th>
                              <th>
                                <span>Contact</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewTarget.contractors.map((contractor) => (
                              <tr key={contractor.id}>
                                <td>{contractor.name}</td>
                                <td>{contractor.contact}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Press</span>
                    {viewTarget.presses.length === 0 ? (
                      <p className="hx-companies-empty">No press added.</p>
                    ) : (
                      <div className="hx-order-badges">
                        {viewTarget.presses.map((press) => (
                          <span key={press.id} className="hx-order-badge">
                            {press.name}
                          </span>
                        ))}
                      </div>
                    )}
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
                                <span>Other Master Nos.</span>
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
                                <td>
                                  {spec.other_masters.length > 0 ? (
                                    <div className="hx-order-badges">
                                      {spec.other_masters.map((om, i) => (
                                        <span key={i} className="hx-order-badge">
                                          {om.punch_type}: {om.master_number}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    '—'
                                  )}
                                </td>
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
                            <span>Other Master Nos.</span>
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
                            <td>
                              {spec.other_masters.length > 0 ? (
                                <div className="hx-order-badges">
                                  {spec.other_masters.map((om, i) => (
                                    <span key={i} className="hx-order-badge">
                                      {om.punch_type}: {om.master_number}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
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

      {directorsTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">{directorsTarget.name} — Directors</h6>
                  <button type="button" className="btn-close" onClick={() => setDirectorsTarget(null)} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="table-responsive">
                    <table className="table mb-0 table-borderless table-rounded">
                      <thead>
                        <tr>
                          <th>
                            <span>Name</span>
                          </th>
                          <th>
                            <span>Contact</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {directorsTarget.directors.map((director) => (
                          <tr key={director.id}>
                            <td>{director.name}</td>
                            <td>{director.contact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setDirectorsTarget(null)}></div>
        </>
      )}

      {contractorsTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">{contractorsTarget.name} — Contractors</h6>
                  <button type="button" className="btn-close" onClick={() => setContractorsTarget(null)} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="table-responsive">
                    <table className="table mb-0 table-borderless table-rounded">
                      <thead>
                        <tr>
                          <th>
                            <span>Name</span>
                          </th>
                          <th>
                            <span>Contact</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractorsTarget.contractors.map((contractor) => (
                          <tr key={contractor.id}>
                            <td>{contractor.name}</td>
                            <td>{contractor.contact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setContractorsTarget(null)}></div>
        </>
      )}

      {pressesTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">{pressesTarget.name} — Press</h6>
                  <button type="button" className="btn-close" onClick={() => setPressesTarget(null)} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="hx-order-badges">
                    {pressesTarget.presses.map((press) => (
                      <span key={press.id} className="hx-order-badge">
                        {press.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setPressesTarget(null)}></div>
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
