import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { AuthProvider, RequireAuth } from './auth/AuthContext.tsx'
import Layout from './components/Layout.tsx'
import Companies from './pages/Companies.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Login from './pages/Login.tsx'
import Orders from './pages/Orders.tsx'
import Users from './pages/Users.tsx'

// No <StrictMode>: AppShell re-injects the theme's ~46 jQuery-era vendor scripts as plain
// <script> tags on every mount (so main.js re-wires submenu toggles/feather icons against
// the fresh DOM each navigation produces). StrictMode's dev-only double-invoke of effects
// would mount -> cleanup -> remount this in one tick, yanking the first batch of scripts
// out mid-load and racing the second batch — harmless for pure-React effects, but this one
// manages real DOM/network side effects a legacy script tag can't safely have "two" of.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthProvider>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/users"
            element={
              <RequireAuth>
                <Users />
              </RequireAuth>
            }
          />
          <Route
            path="/companies"
            element={
              <RequireAuth>
                <Companies />
              </RequireAuth>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireAuth>
                <Orders />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Layout>
    </AuthProvider>
  </BrowserRouter>,
)
