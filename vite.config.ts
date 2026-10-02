import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Production is deployed under https://updates.mrweb.co.in/frontend/, so every root-relative
  // asset path in index.html needs that prefix — but only for `vite build`. `vite dev` serves
  // from the root, so local dev stays unprefixed. Vite injects whichever base applies onto the
  // root-relative paths written in index.html automatically; don't hardcode `/frontend/` there.
  base: command === 'build' ? '/frontend/' : '/',
  // The theme's vendor scripts (dashboardAssets.ts) live under public/html as plain static
  // files with names that never change between builds — unlike the app's own JS/CSS, which
  // Vite content-hashes so a new build is automatically a new URL. A browser (or a CDN/proxy
  // in front of the site) that already cached one of these under its unchanging URL has no
  // reason to ever re-fetch it, so a fix landing in one of them can silently keep not taking
  // effect after a deploy. Baked in once per build (not per request, so normal caching still
  // works between unchanged deploys) and appended as a query string in dashboardAssets.ts.
  define: {
    __BUILD_VERSION__: JSON.stringify(String(Date.now())),
  },
}))
