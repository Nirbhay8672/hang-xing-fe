import { useEffect, useState } from 'react'
import { ApiError } from '../auth/apiClient'
import AppShell from '../components/AppShell'
import '../components/formStyles.css'
import Pagination from '../components/Pagination'
import { usePagination } from '../components/usePagination'
import type { Role } from '../roles/types'
import { rolesService } from '../roles/rolesService'
import './Roles.css'

const USERS_PREVIEW_LIMIT = 4

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * The roles people can be given (Admin, Marketing, Planning, Production) and who holds each.
 * What a role can do is built into the app, so there is nothing to configure here — assign a
 * person's role from the Users page.
 */
export default function Roles() {
  const [roles, setRoles] = useState<Role[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadRoles()
  }, [])

  async function loadRoles() {
    setLoadError(null)
    try {
      setRoles(await rolesService.list())
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load roles.')
    }
  }

  const filteredRoles = roles?.filter((r) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return r.name.toLowerCase().includes(q) || r.users.some((u) => u.name.toLowerCase().includes(q))
  })

  const { page, setPage, totalPages, totalItems, perPage, pageItems: pagedRoles } = usePagination(filteredRoles ?? [], 10)

  const headerActions = (
    <div className="action-btn">
      <div className="form-group mb-0">
        <div className="input-container icon-left position-relative">
          <span className="input-icon icon-left">
            <i className="la la-search"></i>
          </span>
          <input
            type="text"
            className="form-control form-control-default"
            placeholder="Search by role or person"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
    </div>
  )

  return (
    <AppShell title="Roles" actions={headerActions}>
      <div className="row">
        <div className="col-12">
          <div className="contact-list-wrap mb-25">
            <div className="contact-list bg-white radius-xl w-100">
              {loadError && <p className="hx-form-error m-20">{loadError}</p>}
              {roles === null && !loadError && <p className="hx-roles-empty">Loading roles…</p>}
              {filteredRoles && filteredRoles.length === 0 && <p className="hx-roles-empty">No roles found.</p>}

              {filteredRoles && filteredRoles.length > 0 && (
                <div className="table-responsive">
                  <table className="table mb-0 table-borderless table-rounded">
                    <thead>
                      <tr>
                        <th>
                          <span className="userDatatable-title">Role</span>
                        </th>
                        <th>
                          <span>People</span>
                        </th>
                        <th className="c-position">
                          <span>Created</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRoles.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <span className="position">{r.name}</span>
                          </td>
                          <td>
                            {r.users.length > 0 ? (
                              <div className="hx-role-badges">
                                {r.users.slice(0, USERS_PREVIEW_LIMIT).map((u) => (
                                  <span key={u.id} className="hx-role-badge">
                                    {u.name}
                                  </span>
                                ))}
                                {r.users.length > USERS_PREVIEW_LIMIT && (
                                  <span className="hx-role-badge hx-role-badge--more">+{r.users.length - USERS_PREVIEW_LIMIT} more</span>
                                )}
                              </div>
                            ) : (
                              <span className="position">Nobody yet</span>
                            )}
                          </td>
                          <td>
                            <span className="position">{formatDate(r.created_at)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination page={page} totalPages={totalPages} totalItems={totalItems} perPage={perPage} onPageChange={setPage} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
