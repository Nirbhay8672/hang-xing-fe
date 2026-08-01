import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Deployed under https://www.hengxingmould.com/frontend/ (public_html/frontend) — every
  // root-relative asset path in the app is prefixed with this at build time via
  // import.meta.env.BASE_URL.
  base: '/frontend/',
})
