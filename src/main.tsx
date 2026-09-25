import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import './theme.css'
import { AuthProvider, RequireAuth, RequirePermission } from './auth/AuthContext.tsx'
import Layout from './components/Layout.tsx'
import Companies from './pages/Companies.tsx'
import Complaints from './pages/Complaints.tsx'
import DeleteRequests from './pages/DeleteRequests.tsx'
import Home from './pages/Home.tsx'
import Login from './pages/Login.tsx'
import Orders from './pages/Orders.tsx'
import Planning from './pages/Planning.tsx'
import Problems from './pages/Problems.tsx'
import Production from './pages/Production.tsx'
import Profile from './pages/Profile.tsx'
import Roles from './pages/Roles.tsx'
import Settings from './pages/Settings.tsx'
import Sizes from './pages/Sizes.tsx'
import Users from './pages/Users.tsx'

// Signed-in pages only open for the roles meant to use them (worked out from the person's role,
// see RequirePermission); leave `any` out for pages every signed-in person can open.
function protect(page: ReactElement, any?: string[]) {
  return <RequireAuth>{any ? <RequirePermission any={any}>{page}</RequirePermission> : page}</RequireAuth>
}

// No <StrictMode>: AppShell re-injects the theme's ~46 jQuery-era vendor scripts as plain
// <script> tags on every mount (so main.js re-wires submenu toggles/feather icons against
// the fresh DOM each navigation produces). StrictMode's dev-only double-invoke of effects
// would mount -> cleanup -> remount this in one tick, yanking the first batch of scripts
// out mid-load and racing the second batch — harmless for pure-React effects, but this one
// manages real DOM/network side effects a legacy script tag can't safely have "two" of.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={protect(<Home />)} />
          <Route path="/users" element={protect(<Users />, ['view users'])} />
          <Route path="/roles" element={protect(<Roles />, ['view roles'])} />
          <Route path="/profile" element={protect(<Profile />)} />
          <Route path="/companies" element={protect(<Companies />, ['view companies'])} />
          <Route path="/sizes" element={protect(<Sizes />, ['view sizes'])} />
          <Route path="/orders" element={protect(<Orders />, ['view orders'])} />
          <Route path="/planning" element={protect(<Planning />, ['access planning'])} />
          <Route path="/production" element={protect(<Production />, ['access production'])} />
          <Route path="/complaints" element={protect(<Complaints />, ['view complaints'])} />
          <Route path="/problems" element={protect(<Problems />, ['view problems'])} />
          <Route
            path="/delete-requests"
            element={protect(<DeleteRequests />, ['review delete requests', 'request delete orders', 'request delete complaints'])}
          />
          <Route
            path="/settings"
            element={protect(<Settings />, ['view users', 'view roles', 'view sizes'])}
          />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Layout>
    </AuthProvider>
  </BrowserRouter>,
)
