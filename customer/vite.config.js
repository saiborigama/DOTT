import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const httpsEnabled = env.VITE_DEV_HTTPS === 'true'
  const https = httpsEnabled && env.VITE_SSL_KEY && env.VITE_SSL_CERT
    ? {
        key: fs.readFileSync(env.VITE_SSL_KEY),
        cert: fs.readFileSync(env.VITE_SSL_CERT),
      }
    : false
  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      strictPort: true,
      https,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 650,
    },
  }
})
