import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      // Один origin с API: cookie-сессия и CSRF работают без CORS
      proxy: {
        '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:8000', changeOrigin: true },
      },
    },
  }
})
