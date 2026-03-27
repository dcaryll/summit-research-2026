import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/summit-research-2026/wizard-of-os/',
  plugins: [react()],
  server: {
    hmr: true,
    watch: {
      usePolling: true,
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  },
})
