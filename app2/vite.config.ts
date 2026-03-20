import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5181,
    strictPort: true, // Always use 5181 so URL is predictable; fails if port is in use
    headers: {
      'Cache-Control': 'no-store',
    },
  },
})
