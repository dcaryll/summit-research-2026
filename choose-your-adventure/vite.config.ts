import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** In dev, swapping pixels in `src/images` often does not HMR the importing TSX; force a full reload. */
function reloadWhenSrcImagesChange(): Plugin {
  return {
    name: 'reload-when-src-images-change',
    apply: 'serve',
    configureServer(server) {
      const maybeReload = (file: string) => {
        const normalized = file.replace(/\\/g, '/')
        if (normalized.indexOf('/src/images/') === -1) return
        if (!/\.(apng|png|jpe?g|webp|gif|svg)$/i.test(normalized)) return
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('change', maybeReload)
      server.watcher.on('add', maybeReload)
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/summit-research-2026/choose-your-adventure/' : '/',
  plugins: [react(), reloadWhenSrcImagesChange()],
  server: {
    port: 5181,
    strictPort: true, // Always use 5181 so URL is predictable; fails if port is in use
    headers: {
      'Cache-Control': 'no-store',
    },
  },
}))
