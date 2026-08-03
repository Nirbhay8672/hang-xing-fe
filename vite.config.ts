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
}))
