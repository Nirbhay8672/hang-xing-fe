import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAdmin, isMarketing } from '../auth/roleUtils'
import AppShell from '../components/AppShell'
import './Settings.css'

interface SettingsTileConfig {
  path: string
  icon: string
  title: string
  /** Same visibility rule as the module's own route guard — a tile is only shown to
   * whoever could actually open that page anyway. */
  visible: boolean
}

interface SettingsTileProps {
  icon: string
  title: string
  onClick: () => void
}

function SettingsTile({ icon, title, onClick }: SettingsTileProps) {
  return (
    <div className="col-xl-3 col-lg-4 col-md-6 col-12">
      <button type="button" className="hx-settings-tile" onClick={onClick}>
        <span className="hx-settings-tile__icon">
          <i className={`la ${icon}`}></i>
        </span>
        <span className="hx-settings-tile__title">{title}</span>
      </button>
    </div>
  )
}

export default function Settings() {
  const { user, can } = useAuth()
  const navigate = useNavigate()

  const admin = user ? isAdmin(user) : false
  const marketing = user ? isMarketing(user) : false

  const tiles: SettingsTileConfig[] = [
    {
      path: '/users',
      icon: 'la-user-friends',
      title: 'Users',
      visible: can('view users') && admin,
    },
    {
      path: '/roles',
      icon: 'la-user-shield',
      title: 'Roles',
      visible: can('view roles') && admin,
    },
    {
      path: '/sizes',
      icon: 'la-ruler-combined',
      title: 'Sizes',
      visible: can('view sizes'),
    },
    {
      path: '/problems',
      icon: 'la-exclamation-triangle',
      title: 'Problems',
      visible: can('view problems') && (admin || marketing),
    },
  ]

  const visibleTiles = tiles.filter((t) => t.visible)

  return (
    <AppShell title="Settings">
      <div className="row">
        <div className="col-12">
          <p className="hx-settings-subtitle">Configuration and master data used across the app</p>
        </div>
      </div>

      {visibleTiles.length === 0 ? (
        <p className="hx-settings-empty">Nothing to show here yet.</p>
      ) : (
        <div className="row">
          {visibleTiles.map((tile) => (
            <SettingsTile
              key={tile.path}
              icon={tile.icon}
              title={tile.title}
              onClick={() => navigate(tile.path)}
            />
          ))}
        </div>
      )}
    </AppShell>
  )
}
