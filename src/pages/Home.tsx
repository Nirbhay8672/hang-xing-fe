import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Dashboard from './Dashboard'

/**
 * Landing page. Admin gets the overview; everyone else only works in their own modules, so
 * they're taken straight to the first one (Marketing: Companies, Planning: Planning,
 * Production: Production) instead of to company-wide figures.
 */
export default function Home() {
  const { user, can } = useAuth()
  if (!user) return null

  const isOverviewUser = can('view users')
  if (!isOverviewUser) {
    if (can('view companies')) return <Navigate to="/companies" replace />
    if (can('access planning')) return <Navigate to="/planning" replace />
    if (can('access production')) return <Navigate to="/production" replace />
  }

  return <Dashboard />
}
