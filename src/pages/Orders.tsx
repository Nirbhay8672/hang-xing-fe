import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError } from '../auth/apiClient'
import { useAuth } from '../auth/AuthContext'
import { isAdmin, isMarketing } from '../auth/roleUtils'
import AppShell from '../components/AppShell'
import { FloatingInput, FloatingSelect, FloatingTextarea } from '../components/FloatingField'
import '../components/detailView.css'
import '../components/formStyles.css'
import '../components/iconButtons.css'
import Pagination from '../components/Pagination'
import '../components/statusPill.css'
import { useAutoRefresh } from '../components/useAutoRefresh'
import { usePagination } from '../components/usePagination'
import type { Company } from '../companies/types'
import { companiesService } from '../companies/companiesService'
import { masterNumbersService } from '../masterNumbers/masterNumbersService'
import { compareSizeNames } from '../sizes/sortSizes'
import { useFormErrors } from '../components/formValidation'
import RequestDeleteModal from '../components/RequestDeleteModal'
import { usePendingDeleteRequestIds } from '../deleteRequests/usePendingDeleteRequests'
import type { CreateOrderRequest, Order } from '../orders/types'
import { ordersService } from '../orders/ordersService'
import type { User } from '../users/types'
import { usersService } from '../users/usersService'
import OrderProgressModal from './OrderProgressModal'
import './Orders.css'
import './PlanOrderModal.css'
import './TrackOrderModal.css'

type SortField = 'order_no' | 'company' | 'size' | 'expected_delivery_date'
type SortDir = 'asc' | 'desc'

function sortValue(order: Order, field: SortField): string | number | null {
  switch (field) {
    case 'order_no':
      return order.order_no ?? ''
    case 'company':
      return order.company?.name ?? ''
    case 'size':
      return order.size ?? ''
    case 'expected_delivery_date':
      return order.expected_delivery_date ? new Date(order.expected_delivery_date).getTime() : null
  }
}

// What is on hold for an order: the whole order (planning status "On Hold"), some of its items
// (shown as "2/10 hold"), or both — whichever was put on hold most recently supplies who/when.
function holdInfo(order: Order): { label: string; whole: boolean; by: string | null; at: string | null } | null {
  const whole = order.planning_status === 'On Hold'
  const items = order.held_items_count ?? 0
  if (!whole && items === 0) return null

  const wholeAt = whole ? order.held_at : null
  const itemsAt = items > 0 ? (order.item_hold?.at ?? null) : null
  const useWhole = whole && (!itemsAt || (wholeAt !== null && new Date(wholeAt) >= new Date(itemsAt)))

  return {
    label: `${whole ? order.quantity : items}/${order.quantity} hold`,
    whole,
    by: useWhole ? (order.holder?.name ?? null) : (order.item_hold?.by ?? null),
    at: useWhole ? wholeAt : itemsAt,
  }
}

function orderTypePillClass(orderType: string): string {
  return orderType === 'New' ? 'hx-status-pill--new' : 'hx-status-pill--rc'
}

// A single status through the order's whole life: Pending (not yet planned) -> Planned
// (planning saved) -> a live percentage (once any production task is checked) -> Completed
// (100%) — one label instead of separately showing status/planning status/progress.
function unifiedStatus(order: Order): string {
  const progress = order.production_progress ?? 0
  if (progress === 100) return 'Completed'
  if (progress > 0) return `${progress}%`
  if (order.planning_status === 'On Hold') return 'On Hold'
  if (order.planning_status === 'Planned') return 'Planned'
  return 'Pending'
}

function unifiedStatusPillClass(order: Order): string {
  const progress = order.production_progress ?? 0
  if (progress === 100) return 'hx-status-pill--complete'
  if (progress > 0) return 'hx-status-pill--inprogress'
  if (order.planning_status === 'On Hold') return 'hx-status-pill--onhold'
  if (order.planning_status === 'Planned') return 'hx-status-pill--planned'
  return 'hx-status-pill--pending'
}

// The completed/remaining breakdown only makes sense while a live percentage is showing —
// Pending/Planned/Completed are already unambiguous on their own.
function isInProgressStatus(order: Order): boolean {
  const progress = order.production_progress ?? 0
  return progress > 0 && progress < 100
}

// Whether the status pill should open the Task Progress modal — anywhere production has
// actually started (a live percentage, or Completed) has a real per-task breakdown worth
// showing; Pending/Planned haven't started yet, so there's nothing to open.
function hasProgressData(order: Order): boolean {
  return (order.production_progress ?? 0) > 0
}

// Exact completed/remaining counts behind the percentage — assigned tasks x punch numbers is
// the total number of (task, punch) pairs; each pair is done once that punch's
// completed_tasks includes that task.
function progressDetail(order: Order): string {
  const punchNumbers = order.punch_numbers ?? []
  const totalPairs = (order.planning_tasks ?? []).length * punchNumbers.length
  if (totalPairs === 0) return 'No production tasks assigned yet.'
  const completedPairs = punchNumbers.reduce((sum, p) => sum + (p.completed_tasks?.length ?? 0), 0)
  const remaining = totalPairs - completedPairs
  return `${completedPairs} of ${totalPairs} done · ${remaining} remaining`
}

function sortOrders(list: Order[], field: SortField | null, dir: SortDir): Order[] {
  // Default (no column sort applied): newest orders first, regardless of what order the API
  // returned them in.
  if (!field) return [...list].sort((a, b) => b.id - a.id)
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

const ORDER_TYPE_OPTIONS = ['New', 'RC', 'RR']
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
  specification_ids: string[]
  punch_type: string
  order_type: string
  quantity: string
  user_id: string
  expected_delivery_date: string
  master_number: string
  punch_numbers: string[]
  remarks: string
}

const EMPTY_FORM: OrderFormState = {
  company_id: '',
  size: '',
  specification_ids: [],
  punch_type: '',
  order_type: '',
  quantity: '1',
  user_id: '',
  expected_delivery_date: '',
  master_number: '',
  punch_numbers: [],
  remarks: '',
}

const PUNCH_NUMBER_PREFIX = 'HXN-'
const PUNCH_NUMBER_PAD = 4

function extractPunchSeq(punchNumber: string): number | null {
  const match = new RegExp(`^${PUNCH_NUMBER_PREFIX}(\\d+)$`).exec(punchNumber)
  return match ? parseInt(match[1], 10) : null
}

function formatPunchNumber(seq: number): string {
  return `${PUNCH_NUMBER_PREFIX}${String(seq).padStart(PUNCH_NUMBER_PAD, '0')}`
}

const GENERAL_ERROR_KEY = '_general'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
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

function extractErrors(error: unknown, fallback: string): Record<string, string[]> {
  if (error instanceof ApiError) {
    if (error.body?.errors) return error.body.errors
    return { [GENERAL_ERROR_KEY]: [error.body?.message ?? fallback] }
  }
  return { [GENERAL_ERROR_KEY]: [fallback] }
}

export default function Orders() {
  const { can, user } = useAuth()
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // "On Hold" tab (Admin): the orders Planning has put on hold. Kept in the URL (?tab=hold) so the
  // header bell and the dashboard card can link straight to it.
  const [searchParams, setSearchParams] = useSearchParams()
  const canSeeHolds = can('view held orders')
  // Marketing adds and views orders but doesn't edit existing ones (unless they're also an Admin).
  const canEditOrders = can('edit orders') && !(user && isMarketing(user) && !isAdmin(user))
  const tab: 'all' | 'hold' = canSeeHolds && searchParams.get('tab') === 'hold' ? 'hold' : 'all'
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [companies, setCompanies] = useState<Company[]>([])
  const [users, setUsers] = useState<User[]>([])

  const [viewTarget, setViewTarget] = useState<Order | null>(null)
  const [viewCompany, setViewCompany] = useState<Company | null>(null)
  const [viewLoadingId, setViewLoadingId] = useState<number | null>(null)
  const [viewFetchError, setViewFetchError] = useState<string | null>(null)

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null)
  const [editFetchError, setEditFetchError] = useState<string | null>(null)
  const [form, setForm] = useState<OrderFormState>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const orderFormRef = useRef<HTMLFormElement>(null)
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null)
  // People without "delete orders" (Marketing) can't delete directly — they ask an Admin instead.
  const [requestDeleteTarget, setRequestDeleteTarget] = useState<Order | null>(null)
  const canRequestDelete = !can('delete orders') && can('request delete orders')
  const { pendingIds: pendingDeleteIds, addPending: addPendingDelete } = usePendingDeleteRequestIds('order', canRequestDelete)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [progressOrderId, setProgressOrderId] = useState<number | null>(null)

  const [masterNoModalOpen, setMasterNoModalOpen] = useState(false)
  const [newMasterNo, setNewMasterNo] = useState('')
  const [masterNoError, setMasterNoError] = useState<string | null>(null)
  const [masterNoSubmitting, setMasterNoSubmitting] = useState(false)
  const addMasterNo = useFormErrors()

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

  // Quietly picks up changes other people made (an item put on hold, a status change, a new
  // order) without showing a loading state or an error if a refresh fails.
  async function refreshOrders() {
    try {
      setOrders(await ordersService.list())
    } catch {
      // keep showing what we already have
    }
  }

  useAutoRefresh(refreshOrders)

  // The company / user an order was raised for may have been deleted since. They no longer show up
  // in the lists to pick from, but the order keeps them — so they're added back for the order
  // that's being edited.
  const [orderRefs, setOrderRefs] = useState<{ company: Company | null; user: User | null }>({ company: null, user: null })
  const companyOptions = orderRefs.company ? [...companies, orderRefs.company] : companies
  const userOptions = orderRefs.user ? [...users, orderRefs.user] : users

  const selectedCompany = companyOptions.find((c) => c.id === Number(form.company_id)) ?? null

  const sizeOptions = Array.from(new Set(selectedCompany?.manufacturing_specifications.map((spec) => spec.size) ?? [])).sort(
    compareSizeNames,
  )

  const matchingSizeSpecs = selectedCompany?.manufacturing_specifications.filter((spec) => spec.size === form.size) ?? []

  // A company can have several spec rows sharing one `size` (different master numbers) — the
  // Size Details table's checkboxes let the user narrow which of those rows' master numbers
  // actually apply, since "every row for the size" is otherwise ambiguous when they differ.
  function getMasterNoOptions(company: Company | null, size: string, punchType: string, specificationIds?: string[]): string[] {
    if (!company || !size || !punchType) return []
    const isUpper = punchType.startsWith('U')
    const isLower = punchType.startsWith('L')
    if (!isUpper && !isLower) return []
    const values: string[] = []
    for (const spec of company.manufacturing_specifications) {
      if (spec.size !== size) continue
      if (specificationIds && specificationIds.length > 0 && !specificationIds.includes(String(spec.id))) continue
      // The plain Upper/Lower slot applies broadly to any punch-type variant on that side...
      if (isUpper && spec.up_master_no) values.push(spec.up_master_no)
      if (isLower && spec.lp_master_no) values.push(spec.lp_master_no)
      // ...while an "other master" is scoped to one exact punch-type variant (e.g. "U - DIN").
      for (const other of spec.other_masters ?? []) {
        if (other.punch_type === punchType) values.push(other.master_number)
      }
    }
    return Array.from(new Set(values))
  }

  const masterNoOptions = Array.from(
    new Set([
      ...(form.master_number ? [form.master_number] : []),
      ...getMasterNoOptions(selectedCompany, form.size, form.punch_type, form.specification_ids),
    ]),
  )

  function orderToForm(order: Order, companyList: Company[] = companies): OrderFormState {
    return {
      company_id: String(order.company_id),
      size: order.size,
      // Older orders (saved before this field existed) have no specification_ids — fall back
      // to every spec row for this size, same as the create-form default (all checked).
      specification_ids:
        order.specification_ids && order.specification_ids.length > 0
          ? order.specification_ids.map(String)
          : (companyList.find((c) => c.id === order.company_id)?.manufacturing_specifications ?? [])
              .filter((s) => s.size === order.size)
              .map((s) => String(s.id)),
      punch_type: order.punch_type,
      order_type: order.order_type,
      quantity: String(order.quantity),
      user_id: String(order.user_id),
      expected_delivery_date: order.expected_delivery_date?.slice(0, 10) ?? '',
      master_number: order.master_number,
      // Non-New orders (RC, RR, ...) always show one input per piece, even if fewer (or none)
      // were actually saved — e.g. an order created with every field left blank has zero rows.
      punch_numbers:
        order.order_type !== 'New'
          ? resizeBlankPunchNumbers(order.quantity, (order.punch_numbers ?? []).map((p) => p.punch_number))
          : (order.punch_numbers ?? []).map((p) => p.punch_number),
      remarks: order.remarks ?? '',
    }
  }

  function openCreateModal() {
    setEditingOrder(null)
    setOrderRefs({ company: null, user: null })
    setForm({ ...EMPTY_FORM, user_id: user ? String(user.id) : '' })
    setFormErrors({})
    setModalMode('create')
  }

  async function openViewModal(order: Order) {
    setViewFetchError(null)
    setViewLoadingId(order.id)
    try {
      const fresh = await ordersService.get(order.id)
      setViewTarget(fresh)
      // The company embedded on the order is a lightweight summary (no
      // manufacturing_specifications) — fetch the full record to look up the Upper/Lower
      // Punch size relevant to this order.
      const fullCompany = await companiesService.get(fresh.company_id)
      setViewCompany(fullCompany)
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
      const deletedCompany = companies.some((c) => c.id === fresh.company_id)
        ? null
        : await companiesService.get(fresh.company_id).catch(() => null)
      const deletedUser = users.some((u) => u.id === fresh.user_id) ? null : (fresh.user ?? null)
      setOrderRefs({ company: deletedCompany, user: deletedUser })
      setEditingOrder(fresh)
      setForm(orderToForm(fresh, deletedCompany ? [...companies, deletedCompany] : companies))
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

  function clearFormError(...keys: string[]) {
    setFormErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev
      const next = { ...prev }
      for (const k of keys) delete next[k]
      return next
    })
  }

  // Everything except Remarks (and RC/RR punch numbers, which are optional) must be filled in.
  function validateOrderForm(): Record<string, string[]> {
    const errors: Record<string, string[]> = {}
    if (!form.company_id) errors.company_id = ['Company is required.']
    if (!form.size) errors.size = ['Size is required.']
    if (!form.punch_type) errors.punch_type = ['Punch type is required.']
    if (!form.order_type) errors.order_type = ['Order type is required.']
    if (form.quantity.trim() === '') errors.quantity = ['Quantity is required.']
    else if (!(Number(form.quantity) >= 1)) errors.quantity = ['Quantity must be at least 1.']
    if (!form.user_id) errors.user_id = ['Order by is required.']
    if (!form.expected_delivery_date) errors.expected_delivery_date = ['Expected delivery date is required.']
    if (!form.master_number) errors.master_number = ['Master number is required.']
    return errors
  }

  function scrollToFirstInvalid() {
    // Runs after React has re-rendered the fields with their error state applied.
    setTimeout(() => {
      const first = orderFormRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      first?.focus({ preventScroll: true })
    }, 0)
  }

  function handleCompanyChange(companyId: string) {
    setForm((f) => ({ ...f, company_id: companyId, size: '', specification_ids: [], master_number: '' }))
    clearFormError('company_id')
  }

  function handleSizeChange(size: string) {
    // Default to every spec row for this size checked — the checkboxes in the Size Details
    // table let the user narrow it down from there.
    const specIds = (selectedCompany?.manufacturing_specifications ?? []).filter((s) => s.size === size).map((s) => String(s.id))
    const options = getMasterNoOptions(selectedCompany, size, form.punch_type, specIds)
    setForm((f) => ({ ...f, size, specification_ids: specIds, master_number: options[0] ?? '' }))
    clearFormError('size', 'master_number')
  }

  function toggleSpecification(specificationId: string) {
    setForm((f) => {
      const specification_ids = f.specification_ids.includes(specificationId)
        ? f.specification_ids.filter((id) => id !== specificationId)
        : [...f.specification_ids, specificationId]
      const options = getMasterNoOptions(selectedCompany, f.size, f.punch_type, specification_ids)
      return { ...f, specification_ids, master_number: options[0] ?? '' }
    })
    clearFormError('master_number')
  }

  function toggleAllSpecifications() {
    setForm((f) => {
      const allIds = matchingSizeSpecs.map((s) => String(s.id))
      const specification_ids = f.specification_ids.length === allIds.length ? [] : allIds
      const options = getMasterNoOptions(selectedCompany, f.size, f.punch_type, specification_ids)
      return { ...f, specification_ids, master_number: options[0] ?? '' }
    })
    clearFormError('master_number')
  }

  function handlePunchTypeChange(punchType: string) {
    const options = getMasterNoOptions(selectedCompany, form.size, punchType, form.specification_ids)
    setForm((f) => ({ ...f, punch_type: punchType, master_number: options[0] ?? '' }))
    clearFormError('punch_type', 'master_number')
  }

  // Punch numbers are a running sequence shared across every "New" order ever placed, so the
  // next batch has to continue from the highest HXN-#### seen anywhere in the already-loaded
  // orders (plus whatever this form has already generated for itself).
  function syncPunchNumbers(quantity: number, current: string[]): string[] {
    if (quantity <= 0) return []
    if (current.length === quantity) return current
    if (current.length > quantity) return current.slice(0, quantity)

    // Only "New" orders draw from the HXN-#### sequence — RC/RR punch numbers are free text
    // (e.g. "A1") that could coincidentally match the pattern and shouldn't skew the count.
    const seenSeqs = (orders ?? [])
      .filter((o) => o.order_type === 'New')
      .flatMap((o) => (o.punch_numbers ?? []).map((p) => extractPunchSeq(p.punch_number)))
    const currentSeqs = current.map(extractPunchSeq)
    const maxSeq = Math.max(0, ...[...seenSeqs, ...currentSeqs].filter((n): n is number => n !== null))

    const additional: string[] = []
    for (let i = 1; i <= quantity - current.length; i++) {
      additional.push(formatPunchNumber(maxSeq + i))
    }
    return [...current, ...additional]
  }

  // RC punch numbers aren't part of the HXN-#### sequence — they're optional, freely-typed
  // per-piece fields, so resizing just pads/trims with blanks instead of generating anything.
  function resizeBlankPunchNumbers(quantity: number, current: string[]): string[] {
    if (quantity <= 0) return []
    if (current.length === quantity) return current
    if (current.length > quantity) return current.slice(0, quantity)
    return [...current, ...Array.from({ length: quantity - current.length }, () => '')]
  }

  function punchNumbersForOrderType(orderType: string, quantity: number, current: string[]): string[] {
    if (!orderType) return []
    if (orderType === 'New') return syncPunchNumbers(quantity, current)
    return resizeBlankPunchNumbers(quantity, current)
  }

  function handleQuantityChange(quantity: string) {
    setForm((f) => ({
      ...f,
      quantity,
      punch_numbers: punchNumbersForOrderType(f.order_type, Number(quantity) || 0, f.punch_numbers),
    }))
    clearFormError('quantity')
  }

  function handleOrderTypeChange(orderType: string) {
    setForm((f) => ({
      ...f,
      order_type: orderType,
      // Switching type changes what the list even means (auto sequence vs. free text), so
      // start each type fresh rather than reinterpreting the other type's values.
      punch_numbers: punchNumbersForOrderType(orderType, Number(f.quantity) || 0, []),
    }))
    clearFormError('order_type')
  }

  function handlePunchNumberInputChange(index: number, value: string) {
    setForm((f) => ({
      ...f,
      punch_numbers: f.punch_numbers.map((n, i) => (i === index ? value : n)),
    }))
  }

  function openAddMasterNoModal() {
    setNewMasterNo('')
    setMasterNoError(null)
    addMasterNo.setFormErrors({})
    setMasterNoModalOpen(true)
  }

  function closeAddMasterNoModal() {
    if (masterNoSubmitting) return
    setMasterNoModalOpen(false)
  }

  async function handleAddMasterNo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newMasterNo.trim() === '') {
      addMasterNo.showErrors({ master_number: ['Master number is required.'] })
      return
    }
    setMasterNoSubmitting(true)
    setMasterNoError(null)
    try {
      const companyId = Number(form.company_id)
      const updatedSpec = await masterNumbersService.create({
        company_id: companyId,
        size: form.size,
        punch_type: form.punch_type,
        master_number: newMasterNo,
      })
      // The backend attaches the new master number onto the existing specification and hands
      // it back — replace that row in place (rather than appending a new one) so the Size
      // Details table and Master Number dropdown both pick it up immediately.
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === companyId
            ? {
                ...c,
                manufacturing_specifications: c.manufacturing_specifications.map((s) =>
                  s.id === updatedSpec.id ? updatedSpec : s,
                ),
              }
            : c,
        ),
      )
      setForm((f) => ({ ...f, master_number: newMasterNo }))
      setMasterNoModalOpen(false)
    } catch (err) {
      setMasterNoError(err instanceof ApiError ? err.message : 'Failed to add master number.')
    } finally {
      setMasterNoSubmitting(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clientErrors = validateOrderForm()
    if (Object.keys(clientErrors).length > 0) {
      setFormErrors(clientErrors)
      scrollToFirstInvalid()
      return
    }
    setSubmitting(true)
    setFormErrors({})
    try {
      // RC punch numbers are optional per-piece fields, so blanks the user left empty are
      // dropped rather than sent as empty strings.
      const punchNumbers = form.punch_numbers.filter((n) => n.trim() !== '')
      const payload: CreateOrderRequest = {
        company_id: Number(form.company_id),
        user_id: Number(form.user_id),
        size: form.size,
        specification_ids: form.specification_ids.length > 0 ? form.specification_ids.map(Number) : undefined,
        punch_type: form.punch_type,
        order_type: form.order_type,
        quantity: Number(form.quantity),
        expected_delivery_date: form.expected_delivery_date,
        master_number: form.master_number,
        punch_numbers: punchNumbers.length > 0 ? punchNumbers : undefined,
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

  const heldCount = orders?.filter((o) => holdInfo(o) !== null).length ?? 0
  const tabOrders = orders?.filter((o) => tab === 'all' || holdInfo(o) !== null)
  const searchedOrders = tabOrders?.filter((o) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      o.order_no?.toLowerCase().includes(q) ||
      o.company?.name.toLowerCase().includes(q) ||
      o.master_number?.toLowerCase().includes(q) ||
      (tab === 'hold' && (holdInfo(o)?.by ?? '').toLowerCase().includes(q)) ||
      // Punch numbers are set once the order type (New/RC/RR) is chosen — auto-generated
      // HXN-#### for New, free-typed for RC/RR — so searching by one should find the order.
      (o.punch_numbers ?? []).some((p) => p.punch_number?.toLowerCase().includes(q))
    )
  })
  // On the Hold tab the most recently held order comes first unless a column sort is chosen.
  const filteredOrders =
    searchedOrders &&
    (tab === 'hold' && !sortField
      ? [...searchedOrders].sort((a, b) => new Date(holdInfo(b)?.at ?? 0).getTime() - new Date(holdInfo(a)?.at ?? 0).getTime())
      : sortOrders(searchedOrders, sortField, sortDir))

  const {
    page: ordersPage,
    setPage: setOrdersPage,
    totalPages: ordersTotalPages,
    totalItems: ordersTotalItems,
    perPage: ordersPerPage,
    pageItems: pagedOrders,
  } = usePagination(filteredOrders ?? [], 10)

  function changeTab(next: 'all' | 'hold') {
    setSearchParams(next === 'hold' ? { tab: 'hold' } : {}, { replace: true })
    setOrdersPage(1)
    refreshOrders()
  }

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
              className="form-control form-control-default hx-orders-search"
              placeholder="Search with..."
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

  // Same company spec rows shown in Create/Edit's "Size Details" table, for the order being
  // viewed — read-only here, no checkboxes. Narrowed to just the spec(s) actually selected for
  // this order (specification_ids) rather than a plain size-string match — the order's size can
  // be free-typed/corrected during Planning, so a loose string match can silently come up empty
  // even when the order clearly has associated spec(s). Older orders saved before
  // specification_ids existed fall back to a size match against every spec row, same as before.
  const viewMatchingSpecs = viewTarget
    ? viewTarget.specification_ids && viewTarget.specification_ids.length > 0
      ? (viewCompany?.manufacturing_specifications ?? []).filter((s) => viewTarget.specification_ids.includes(s.id))
      : (viewCompany?.manufacturing_specifications ?? []).filter((s) => s.size === viewTarget.size)
    : []
  const viewIsUpperPunch = viewTarget ? viewTarget.punch_type.startsWith('U') : false

  // Items of the viewed order split into what is still moving and what Planning has put on hold
  // (every item counts as on hold while the whole order is On Hold).
  const viewWholeHeld = viewTarget?.planning_status === 'On Hold'
  const viewItems = [...(viewTarget?.punch_numbers ?? [])].sort((a, b) => a.id - b.id)
  const viewHeldItems = viewItems.filter((p) => viewWholeHeld || p.is_on_hold)
  const viewActiveItems = viewItems.filter((p) => !viewWholeHeld && !p.is_on_hold)
  const viewHold = viewTarget ? holdInfo(viewTarget) : null
  const viewIsLowerPunch = viewTarget ? viewTarget.punch_type.startsWith('L') : false

  // Every master number that applies to this order's selected spec(s) + punch type — an order
  // can cover several spec rows sharing one size, each with its own master number, so the
  // order's own saved master_number (one choice from among these) isn't the whole picture.
  const viewMasterNumbers = (() => {
    if (!viewTarget) return []
    const values: string[] = [viewTarget.master_number].filter(Boolean)
    for (const spec of viewMatchingSpecs) {
      if (viewIsUpperPunch && spec.up_master_no) values.push(spec.up_master_no)
      if (viewIsLowerPunch && spec.lp_master_no) values.push(spec.lp_master_no)
      for (const other of spec.other_masters ?? []) {
        if (other.punch_type === viewTarget.punch_type) values.push(other.master_number)
      }
    }
    return Array.from(new Set(values))
  })()

  return (
    <AppShell title="Orders" actions={headerActions}>
      <div className="row">
        <div className="col-12">
          <div className="contact-list-wrap mb-25">
            <div className="contact-list bg-white radius-xl w-100">
              {canSeeHolds && (
                <div className="hx-orders-tabs">
                  <button
                    type="button"
                    className={`hx-orders-tab${tab === 'all' ? ' hx-orders-tab--active' : ''}`}
                    onClick={() => changeTab('all')}
                  >
                    All Orders <span className="hx-orders-tab__count">{orders?.length ?? 0}</span>
                  </button>
                  <button
                    type="button"
                    className={`hx-orders-tab${tab === 'hold' ? ' hx-orders-tab--active' : ''}`}
                    onClick={() => changeTab('hold')}
                  >
                    Hold Orders <span className="hx-orders-tab__count">{heldCount}</span>
                  </button>
                </div>
              )}
              {loadError && <p className="hx-form-error m-20">{loadError}</p>}
              {editFetchError && <p className="hx-form-error m-20">{editFetchError}</p>}
              {viewFetchError && <p className="hx-form-error m-20">{viewFetchError}</p>}
              {orders === null && !loadError && <p className="hx-orders-empty">Loading orders…</p>}
              {filteredOrders && filteredOrders.length === 0 && (
                <p className="hx-orders-empty">{tab === 'hold' && !search.trim() ? 'No orders are on hold.' : 'No orders found.'}</p>
              )}

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
                        {tab === 'all' ? (
                          <>
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
                              <button type="button" className="hx-sort-th" onClick={() => handleSort('expected_delivery_date')}>
                                <span>Delivery</span>
                                <i className={sortIconClass('expected_delivery_date')}></i>
                              </button>
                            </th>
                            <th>
                              <span>Status</span>
                            </th>
                          </>
                        ) : (
                          <>
                            <th>
                              <span>Hold</span>
                            </th>
                            <th>
                              <span>Put On Hold By</span>
                            </th>
                            <th>
                              <span>On Hold Since</span>
                            </th>
                          </>
                        )}
                        <th className="c-action">
                          <span className="float-right"></span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedOrders.map((o) => (
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
                          {tab === 'all' ? (
                            <>
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
                                <span className="position">
                                  {o.expected_delivery_date ? formatDate(o.expected_delivery_date) : '—'}
                                </span>
                              </td>
                              <td>
                                {hasProgressData(o) ? (
                                  <button
                                    type="button"
                                    className={`hx-status-pill hx-status-pill--btn hx-tooltip ${unifiedStatusPillClass(o)}`}
                                    data-tooltip={progressDetail(o)}
                                    onClick={() => setProgressOrderId(o.id)}
                                  >
                                    {unifiedStatus(o)}
                                  </button>
                                ) : (
                                  <span className={`hx-status-pill ${unifiedStatusPillClass(o)}`}>{unifiedStatus(o)}</span>
                                )}
                                {o.planning_status !== 'On Hold' && o.held_items_count > 0 && (
                                  <span className="hx-status-pill hx-status-pill--onhold hx-hold-chip">{holdInfo(o)?.label}</span>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              <td>
                                <span className="hx-status-pill hx-status-pill--onhold">{holdInfo(o)?.label}</span>
                              </td>
                              <td>
                                <span className="position">{holdInfo(o)?.by ?? '—'}</span>
                              </td>
                              <td>
                                <span className="position">{holdInfo(o)?.at ? formatDateTime(holdInfo(o)!.at!) : '—'}</span>
                              </td>
                            </>
                          )}
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
                              {canEditOrders && (
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
                              {canRequestDelete && (
                                <button
                                  type="button"
                                  className="hx-icon-btn hx-icon-btn--delete"
                                  aria-label="Request order deletion"
                                  title={pendingDeleteIds.has(o.id) ? 'Delete request waiting for admin approval' : 'Request delete'}
                                  disabled={pendingDeleteIds.has(o.id)}
                                  onClick={() => setRequestDeleteTarget(o)}
                                >
                                  <i className={pendingDeleteIds.has(o.id) ? 'la la-hourglass-half' : 'la la-trash'}></i>
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
                page={ordersPage}
                totalPages={ordersTotalPages}
                totalItems={ordersTotalItems}
                perPage={ordersPerPage}
                onPageChange={setOrdersPage}
              />
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
                    <form ref={orderFormRef} onSubmit={handleSubmit} autoComplete="off" noValidate>
                      {formErrors[GENERAL_ERROR_KEY] && <p className="hx-form-error">{formErrors[GENERAL_ERROR_KEY][0]}</p>}

                      <div className="hx-order-section">
                        <span className="hx-order-section__title">Order Details</span>
                        <div className="row">
                          <div className="col-md-6">
                            <FloatingSelect
                              label="Company"
                              value={form.company_id}
                              onChange={(e) => handleCompanyChange(e.target.value)}
                              error={formErrors.company_id?.[0]}
                            >
                              <option value="">— Select —</option>
                              {companyOptions.map((c) => (
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
                              error={formErrors.size?.[0]}
                            >
                              <option value="">— Select —</option>
                              {sizeOptions.map((size) => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ))}
                            </FloatingSelect>
                          </div>
                          <div className="col-md-6">
                            <FloatingSelect
                              label="Punch Type"
                              value={form.punch_type}
                              onChange={(e) => handlePunchTypeChange(e.target.value)}
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
                              onChange={(e) => handleOrderTypeChange(e.target.value)}
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
                        <div className="hx-order-section__header">
                          <span className="hx-order-section__title">Size Details (from company record)</span>
                          {matchingSizeSpecs.length > 0 && (
                            <button type="button" className="hx-plan-select-all" onClick={toggleAllSpecifications}>
                              {form.specification_ids.length === matchingSizeSpecs.length ? 'Clear All' : 'Select All'}
                            </button>
                          )}
                        </div>
                        {matchingSizeSpecs.length > 0 ? (
                          <div className="table-responsive">
                            <table className="hx-order-spec-table">
                              <thead>
                                <tr>
                                  <th></th>
                                  <th>Greentile Thick</th>
                                  <th>Upper Punch</th>
                                  <th>Up Master No.</th>
                                  <th>Lower Punch</th>
                                  <th>LP Master No.</th>
                                  <th>Other Master Nos.</th>
                                  <th>Cavity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {matchingSizeSpecs.map((spec) => (
                                  <tr key={spec.id}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={form.specification_ids.includes(String(spec.id))}
                                        onChange={() => toggleSpecification(String(spec.id))}
                                        aria-label={`Use specification ${spec.id}`}
                                      />
                                    </td>
                                    <td>{spec.greentile_thick || '-'}</td>
                                    <td>{spec.upper_punch || '-'}</td>
                                    <td>{spec.up_master_no || '-'}</td>
                                    <td>{spec.lower_punch || '-'}</td>
                                    <td>{spec.lp_master_no || '-'}</td>
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
                                        '-'
                                      )}
                                    </td>
                                    <td>{spec.cavity || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
                              onChange={(e) => handleQuantityChange(e.target.value)}
                              error={formErrors.quantity?.[0]}
                            />
                          </div>
                          <div className="col-md-6">
                            <FloatingSelect
                              label="Order By"
                              value={form.user_id}
                              onChange={(e) => {
                                setForm((f) => ({ ...f, user_id: e.target.value }))
                                clearFormError('user_id')
                              }}
                              disabled
                              error={formErrors.user_id?.[0]}
                            >
                              <option value="">— Select —</option>
                              {userOptions.map((u) => (
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
                              onChange={(e) => {
                                setForm((f) => ({ ...f, expected_delivery_date: e.target.value }))
                                clearFormError('expected_delivery_date')
                              }}
                              error={formErrors.expected_delivery_date?.[0]}
                            />
                          </div>
                          <div className="col-md-6">
                            <FloatingSelect
                              label="Master Number"
                              value={form.master_number}
                              onChange={(e) => {
                                setForm((f) => ({ ...f, master_number: e.target.value }))
                                clearFormError('master_number')
                              }}
                              disabled={!form.size || !form.punch_type}
                              error={formErrors.master_number?.[0]}
                            >
                              <option value="">— Select —</option>
                              {masterNoOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </FloatingSelect>
                            {form.size && form.punch_type && (
                              <button type="button" className="hx-add-master-btn" onClick={openAddMasterNoModal}>
                                <i className="la la-plus"></i> Add New Master Number
                              </button>
                            )}
                          </div>
                          {form.order_type === 'New' && form.punch_numbers.length > 0 && (
                            <div className="col-12">
                              <div className="hx-punch-numbers">
                                <span className="hx-punch-numbers__label">Punch Numbers</span>
                                <div className="hx-order-badges">
                                  {form.punch_numbers.map((n) => (
                                    <span key={n} className="hx-order-badge">
                                      {n}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                          {form.order_type !== 'New' && form.order_type !== '' && form.punch_numbers.length > 0 && (
                            <div className="col-12">
                              <div className="hx-punch-numbers">
                                <span className="hx-punch-numbers__label">Punch Numbers (optional)</span>
                                <div className="hx-punch-inputs">
                                  {form.punch_numbers.map((n, i) => (
                                    <input
                                      key={i}
                                      type="text"
                                      className="form-control hx-punch-input"
                                      placeholder={`Punch ${i + 1}`}
                                      value={n}
                                      onChange={(e) => handlePunchNumberInputChange(i, e.target.value)}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
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

      {masterNoModalOpen && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Add New Master Number</h6>
                  <button type="button" className="btn-close" onClick={closeAddMasterNoModal} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <form ref={addMasterNo.formRef} onSubmit={handleAddMasterNo} autoComplete="off" noValidate>
                    {masterNoError && <p className="hx-form-error">{masterNoError}</p>}
                    <FloatingInput
                      label="Master Number"
                      type="text"
                      value={newMasterNo}
                      onChange={(e) => {
                        setNewMasterNo(e.target.value)
                        addMasterNo.clearError('master_number')
                      }}
                      error={addMasterNo.formErrors.master_number?.[0]}
                    />
                    <div className="button-group d-flex justify-content-center pt-20">
                      <button
                        type="button"
                        className="btn btn-sm hx-btn-secondary btn-rounded me-10"
                        onClick={closeAddMasterNoModal}
                        disabled={masterNoSubmitting}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-sm btn-primary btn-rounded" disabled={masterNoSubmitting}>
                        {masterNoSubmitting ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeAddMasterNoModal}></div>
        </>
      )}

      {viewTarget && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content radius-xl">
                <div className="modal-header">
                  <h6 className="modal-title fw-500">Order Details</h6>
                  {viewTarget.planned_at && (
                    <span className="hx-track-planned-at">Planned @ {formatDateTime(viewTarget.planned_at)}</span>
                  )}
                  <button type="button" className="btn-close" onClick={() => setViewTarget(null)} aria-label="Close">
                    <i className="las la-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="hx-order-detail-hero">
                    <div>
                      <span className="hx-order-detail-hero__order-no">{viewTarget.order_no}</span>
                      <span className="hx-order-detail-hero__company">
                        <i className="la la-building"></i>
                        {viewTarget.company?.name}
                      </span>
                    </div>
                    <div className="hx-order-detail-hero__badges">
                      <span className={`hx-status-pill ${orderTypePillClass(viewTarget.order_type)}`}>{viewTarget.order_type}</span>
                      <span className="hx-order-badge">{viewTarget.punch_type}</span>
                    </div>
                  </div>

                  <div className="hx-detail-section">
                    <span className="hx-detail-section__title">Order Info</span>
                    <div className="hx-detail-grid hx-order-detail-grid">
                      <div>
                        <span className="hx-detail-grid__label">Size</span>
                        <span className="hx-detail-grid__value">{viewTarget.size}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Quantity</span>
                        <span className="hx-detail-grid__value">{viewTarget.quantity}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Master Number</span>
                        <span className="hx-detail-grid__value">{viewMasterNumbers.join(', ') || viewTarget.master_number}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">{viewIsUpperPunch ? 'Upper Punch' : 'Lower Punch'}</span>
                        <span className="hx-detail-grid__value">
                          {(viewIsUpperPunch ? viewMatchingSpecs[0]?.upper_punch : viewMatchingSpecs[0]?.lower_punch) || '—'}
                        </span>
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
                        <span className="hx-detail-grid__label">Created</span>
                        <span className="hx-detail-grid__value">{formatDate(viewTarget.created_at)}</span>
                      </div>
                      <div>
                        <span className="hx-detail-grid__label">Status</span>
                        <span
                          className={`hx-status-pill ${unifiedStatusPillClass(viewTarget)} ${
                            isInProgressStatus(viewTarget) ? 'hx-tooltip' : ''
                          }`}
                          data-tooltip={isInProgressStatus(viewTarget) ? progressDetail(viewTarget) : undefined}
                          tabIndex={isInProgressStatus(viewTarget) ? 0 : undefined}
                        >
                          {unifiedStatus(viewTarget)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {viewMatchingSpecs.length > 0 && (
                    <div className="hx-detail-section">
                      <span className="hx-detail-section__title">Size Details (from company record)</span>
                      <div className="table-responsive">
                        <table className="hx-order-spec-table">
                          <thead>
                            <tr>
                              {viewIsUpperPunch && (
                                <>
                                  <th>Upper Punch</th>
                                  <th>Up Master No.</th>
                                </>
                              )}
                              {viewIsLowerPunch && (
                                <>
                                  <th>Lower Punch</th>
                                  <th>LP Master No.</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {viewMatchingSpecs.map((spec) => (
                              <tr key={spec.id}>
                                {viewIsUpperPunch && (
                                  <>
                                    <td>{spec.upper_punch || '-'}</td>
                                    <td>{spec.up_master_no || '-'}</td>
                                  </>
                                )}
                                {viewIsLowerPunch && (
                                  <>
                                    <td>{spec.lower_punch || '-'}</td>
                                    <td>{spec.lp_master_no || '-'}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(viewTarget.punch_numbers ?? []).length > 0 && (
                    <div className="hx-detail-section">
                      <span className="hx-detail-section__title">Punch Numbers</span>
                      {viewHeldItems.length === 0 ? (
                        <div className="hx-order-badges">
                          {(viewTarget.punch_numbers ?? []).map((p) => (
                            <span key={p.id} className="hx-order-badge">
                              {p.punch_number}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="hx-item-groups">
                          <div className="hx-item-group">
                            <span className="hx-item-group__label">Active ({viewActiveItems.length})</span>
                            {viewActiveItems.length > 0 ? (
                              <div className="hx-order-badges">
                                {viewActiveItems.map((p) => (
                                  <span key={p.id} className="hx-order-badge">
                                    {p.punch_number}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="hx-item-group__empty">No active items</span>
                            )}
                          </div>
                          <div className="hx-item-group hx-item-group--hold">
                            <span className="hx-item-group__label">On Hold ({viewHeldItems.length})</span>
                            <div className="hx-order-badges">
                              {viewHeldItems.map((p) => (
                                <span key={p.id} className="hx-order-badge hx-order-badge--hold">
                                  {p.punch_number}
                                </span>
                              ))}
                            </div>
                            {viewHold?.by || viewHold?.at ? (
                              <span className="hx-item-group__meta">
                                Put on hold{viewHold.by ? ` by ${viewHold.by}` : ''}
                                {viewHold.at ? ` · ${formatDateTime(viewHold.at)}` : ''}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}
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

      {requestDeleteTarget && (
        <RequestDeleteModal
          subject="order"
          subjectId={requestDeleteTarget.id}
          label={requestDeleteTarget.order_no}
          onClose={() => setRequestDeleteTarget(null)}
          onRequested={(request) => addPendingDelete(request.subject_id)}
        />
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
                    This will delete order <strong>{deleteTarget.order_no}</strong>. The company and other records it refers to are not affected.
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

      {progressOrderId !== null && (
        <OrderProgressModal orderId={progressOrderId} onClose={() => setProgressOrderId(null)} />
      )}
    </AppShell>
  )
}
