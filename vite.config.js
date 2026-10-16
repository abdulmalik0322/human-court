import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site under /human-court/ — the base must match
  // so asset URLs and client-side routing resolve correctly in production.
  // Local dev (`npm run dev`) is unaffected (served from /).
  base: process.env.GHPAGES ? '/human-court/' : '/',
  server: {
    // Bind the LAN interface too — without this Vite only listens on
    // localhost and the site can NEVER open on the phone (even with the
    // correct http://192.168.x.x:5173). With '0.0.0.0' any device on the
    // same Wi-Fi can reach the dev server.
    host: '0.0.0.0',
    proxy: {
      // The Express API runs on :4000 (`npm run server` from the repo root).
      // Same-origin /api calls from the frontend are forwarded there in dev,
      // so the browser never talks to the backend directly (cookies stay
      // same-origin and no CORS workaround is needed).
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
