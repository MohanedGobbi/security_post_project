import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  main: {
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    resolve: { alias: { '@shared': resolve('src/shared'), '@': resolve('src/renderer/src') } },
    plugins: [react()],
    // organisation branding: VITE_BRAND=ghardaia or --mode ghardaia (src/renderer/src/brand.ts)
    define: { __BRAND__: JSON.stringify(process.env.VITE_BRAND || (mode === 'development' || mode === 'production' ? 'default' : mode)) }
  }
}))
