import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isAdmin, isMarketing } from '../auth/roleUtils'
import AppShell from '../components/AppShell'
import './Settings.css'

interface SettingsTileConfig {
  path: string
  icon: string
  title: string
  description: string
  /** Accent color for the tile's icon (see .hx-settings-tile--* in Settings.css). */
  tone: 'navy' | 'gold' | 'teal' | 'rose'
  /** Same visibility rule as the module's own route guard — a tile is only shown to
   * whoever could actually open that page anyway. */
  visible: boolean
}

interface SettingsTileProps {
  icon: string
  title: string
  description: string
  tone: SettingsTileConfig['tone']
  index: number
  onClick: () => void
}

function SettingsTile({ icon, title, description, tone, index, onClick }: SettingsTileProps) {
  return (
    <div className="col-xl-3 col-lg-4 col-md-6 col-12">
      <button
        type="button"
        className={`hx-settings-tile hx-settings-tile--${tone}`}
        style={{ animationDelay: `${0.08 + index * 0.06}s` }}
        onClick={onClick}
      >
        <span className="hx-settings-tile__icon">
          <i className={`la ${icon}`}></i>
        </span>
        <span className="hx-settings-tile__title">{title}</span>
        <span className="hx-settings-tile__desc">{description}</span>
        <span className="hx-settings-tile__go">
          Open <i className="la la-arrow-right"></i>
        </span>
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
      description: 'Team members and their sign-in access',
      tone: 'navy',
      visible: can('view users') && admin,
    },
    {
      path: '/roles',
      icon: 'la-user-shield',
      title: 'Roles',
      description: 'Permission groups given to users',
      tone: 'teal',
      visible: can('view roles') && admin,
    },
    {
      path: '/sizes',
      icon: 'la-ruler-combined',
      title: 'Sizes',
      description: 'Mould sizes available on orders',
      tone: 'gold',
      visible: can('view sizes'),
    },
    {
      path: '/problems',
      icon: 'la-exclamation-triangle',
      title: 'Problems',
      description: 'Problem types used for complaints',
      tone: 'rose',
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
          {visibleTiles.map((tile, index) => (
            <SettingsTile
              key={tile.path}
              icon={tile.icon}
              title={tile.title}
              description={tile.description}
              tone={tile.tone}
              index={index}
              onClick={() => navigate(tile.path)}
            />
          ))}
        </div>
      )}
    </AppShell>
  )
}
