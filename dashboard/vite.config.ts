import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dashboard is a static single-page app served by the server (server/public).
export default defineConfig(({ mode }) => ({
  root: resolve(import.meta.dirname),
  base: '/',
  plugins: [react()],
  // organisation branding: VITE_BRAND=ghardaia or --mode ghardaia (src/renderer/src/brand.ts)
  define: { __BRAND__: JSON.stringify(process.env.VITE_BRAND || (mode === 'development' || mode === 'production' ? 'default' : mode)) },
  resolve: {
    alias: {
      '@shared': resolve(import.meta.dirname, '../src/shared'),
      '@desktop': resolve(import.meta.dirname, '../src/renderer/src')
    }
  },
  build: {
    outDir: resolve(import.meta.dirname, '../server/public'),
    emptyOutDir: true
  },
  server: {
    port: 5180,
    proxy: { '/api': 'http://127.0.0.1:8787' }
  }
}))
