import type { Order } from '../orders/types'
import { compareSizeNames } from '../sizes/sortSizes'
import './OrderFilterBar.css'

export interface OrderFilters {
  search: string
  status: string
  type: string
  company: string
  size: string
}

export const EMPTY_ORDER_FILTERS: OrderFilters = { search: '', status: '', type: '', company: '', size: '' }

export interface StatusOption {
  value: string
  label: string
}

/** Whether an order passes the search text and the Type / Company / Size selections. The Status
 * selection means something different on each page, so the page decides that part itself. */
export function matchesOrderFilters(order: Order, filters: OrderFilters): boolean {
  if (filters.type && order.order_type !== filters.type) return false
  if (filters.company && order.company?.name !== filters.company) return false
  if (filters.size && order.size !== filters.size) return false

  const q = filters.search.trim().toLowerCase()
  if (!q) return true
  return (
    order.order_no?.toLowerCase().includes(q) ||
    order.company?.name.toLowerCase().includes(q) ||
    order.master_number?.toLowerCase().includes(q) ||
    order.size?.toLowerCase().includes(q) ||
    (order.punch_numbers ?? []).some((p) => p.punch_number?.toLowerCase().includes(q))
  )
}

export function hasActiveOrderFilters(filters: OrderFilters): boolean {
  return Object.values(filters).some((value) => value.trim() !== '')
}

interface OrderFilterBarProps {
  /** The orders the page can show — the Company and Size choices come from these. */
  orders: Order[]
  filters: OrderFilters
  onChange: (filters: OrderFilters) => void
  statusOptions: StatusOption[]
  /** How many orders match the filters right now, and how many there are without them. */
  shown: number
  total: number
}

/** Search + Status / Type / Company / Size filters shown above the Planning and Production lists. */
export default function OrderFilterBar({ orders, filters, onChange, statusOptions, shown, total }: OrderFilterBarProps) {
  const companies = Array.from(new Set(orders.map((o) => o.company?.name).filter((n): n is string => Boolean(n)))).sort((a, b) =>
    a.localeCompare(b),
  )
  const sizes = Array.from(new Set(orders.map((o) => o.size).filter((s): s is string => Boolean(s)))).sort(compareSizeNames)
  const types = Array.from(new Set(orders.map((o) => o.order_type).filter(Boolean))).sort()
  const active = hasActiveOrderFilters(filters)

  const set = (patch: Partial<OrderFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="hx-order-filters">
      <div className="hx-order-filters__search input-container icon-left position-relative">
        <span className="input-icon icon-left">
          <i className="la la-search"></i>
        </span>
        <input
          type="text"
          className="form-control form-control-default"
          placeholder="Search order, company, master or punch no."
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          aria-label="Search orders"
        />
      </div>

      <select
        className="form-control form-control-default hx-order-filters__select"
        value={filters.status}
        onChange={(e) => set({ status: e.target.value })}
        aria-label="Filter by status"
      >
        <option value="">All Statuses</option>
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        className="form-control form-control-default hx-order-filters__select"
        value={filters.type}
        onChange={(e) => set({ type: e.target.value })}
        aria-label="Filter by order type"
      >
        <option value="">All Types</option>
        {types.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <select
        className="form-control form-control-default hx-order-filters__select"
        value={filters.company}
        onChange={(e) => set({ company: e.target.value })}
        aria-label="Filter by company"
      >
        <option value="">All Companies</option>
        {companies.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <select
        className="form-control form-control-default hx-order-filters__select"
        value={filters.size}
        onChange={(e) => set({ size: e.target.value })}
        aria-label="Filter by size"
      >
        <option value="">All Sizes</option>
        {sizes.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>

      {active && (
        <button type="button" className="hx-order-filters__clear" onClick={() => onChange(EMPTY_ORDER_FILTERS)}>
          <i className="la la-times"></i> Clear
        </button>
      )}
      <span className="hx-order-filters__count">
        {active ? `${shown} of ${total} orders` : `${total} order${total === 1 ? '' : 's'}`}
      </span>
    </div>
  )
}
