import './PageLoader.css'

export default function PageLoader() {
  return (
    <div className="app-preloader">
      <span className="loader-overlay">
        <div className="atbd-spin-dots spin-lg">
          <span className="spin-dot badge-dot dot-primary" />
          <span className="spin-dot badge-dot dot-primary" />
          <span className="spin-dot badge-dot dot-primary" />
          <span className="spin-dot badge-dot dot-primary" />
        </div>
      </span>
    </div>
  )
}
