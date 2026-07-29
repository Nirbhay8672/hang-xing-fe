import AppShell from '../components/AppShell'
import './Dashboard.css'

interface Bar {
  x: number
  y: number
  h: number
}

interface StatCardProps {
  value: number
  label: string
  variant: 'amber' | 'violet' | 'rose'
  bars: Bar[]
}

function StatCard({ value, label, variant, bars }: StatCardProps) {
  return (
    <div className="col-lg-4 col-md-6 col-12">
      <div className="card hx-stat-card">
        <div className="card-body d-flex align-items-center justify-content-between">
          <div>
            <h3 className="hx-stat-card__value">{value}</h3>
            <p className="hx-stat-card__label">{label}</p>
          </div>
          <div className={`hx-stat-card__icon hx-stat-card__icon--${variant}`}>
            <svg width="34" height="26" viewBox="0 0 34 26" fill="none">
              {bars.map((bar) => (
                <rect key={bar.x} x={bar.x} y={bar.y} width="4" height={bar.h} rx="1" fill="currentColor" />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

const BARS: Record<StatCardProps['variant'], Bar[]> = {
  amber: [
    { x: 0, y: 16, h: 10 },
    { x: 7, y: 10, h: 16 },
    { x: 14, y: 14, h: 12 },
    { x: 21, y: 4, h: 22 },
    { x: 28, y: 8, h: 18 },
  ],
  violet: [
    { x: 0, y: 12, h: 14 },
    { x: 7, y: 6, h: 20 },
    { x: 14, y: 16, h: 10 },
    { x: 21, y: 2, h: 24 },
    { x: 28, y: 10, h: 16 },
  ],
  rose: [
    { x: 0, y: 18, h: 8 },
    { x: 7, y: 8, h: 18 },
    { x: 14, y: 14, h: 12 },
    { x: 21, y: 0, h: 26 },
    { x: 28, y: 6, h: 20 },
  ],
}

export default function Dashboard() {
  return (
    <AppShell title="Dashboard">
      <div className="row">
        <StatCard value={1} label="Company" variant="amber" bars={BARS.amber} />
        <StatCard value={0} label="Planning Orders" variant="violet" bars={BARS.violet} />
        <StatCard value={0} label="Pending Orders" variant="rose" bars={BARS.rose} />
      </div>
    </AppShell>
  )
}
