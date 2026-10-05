import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import './theme.css'
import { AuthProvider, RequireAuth, RequirePermission } from './auth/AuthContext.tsx'
import { ShellLayout } from './components/AppShell.tsx'
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
// see RequirePermission); leave `any` out for pages every signed-in person can open. Sign-in
// itself is checked once, on the shared ShellLayout route all of these sit under.
function protect(page: ReactElement, any?: string[]) {
  return any ? <RequirePermission any={any}>{page}</RequirePermission> : page
}

// No <StrictMode>: ShellLayout injects the theme's ~46 jQuery-era vendor scripts as plain
// <script> tags when it mounts. StrictMode's dev-only double-invoke of effects would mount ->
// cleanup -> remount it in one tick — harmless for pure-React effects, but the vendor scripts
// wire themselves to the shell DOM they find when they execute, which a legacy script tag
// can't safely do "twice" against two different copies of that DOM.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <AuthProvider>
      <Layout>
        <Routes>
          {/* Every signed-in page shares one persistent header + sidebar (ShellLayout); moving
              between pages only swaps the page content inside it — no full reload. */}
          <Route
            element={
              <RequireAuth>
                <ShellLayout />
              </RequireAuth>
            }
          >
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
          </Route>
          <Route path="/login" element={<Login />} />
        </Routes>
      </Layout>
    </AuthProvider>
  </BrowserRouter>,
)
