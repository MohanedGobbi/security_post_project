import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Web demo for Vercel: landing page + reception app + dashboard, all running in the browser on sample data.
const r = (p: string): string => resolve(import.meta.dirname, p)

// organisation branding: VITE_BRAND=ghardaia or --mode ghardaia (src/renderer/src/brand.ts)
export default defineConfig(({ mode }) => ({
  root: r('.'),
  base: '/',
  plugins: [react()],
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1'), __BRAND__: JSON.stringify(process.env.VITE_BRAND || (mode === 'development' || mode === 'production' ? 'default' : mode)) },
  resolve: {
    alias: {
      '@shared': r('../src/shared'),
      '@renderer': r('../src/renderer/src'),
      '@desktop': r('../src/renderer/src'),
      '@dashboard': r('../dashboard/src'),
      '@': r('../src/renderer/src')
    }
  },
  build: {
    outDir: r('../demo-dist'),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: { main: r('index.html'), app: r('app/index.html'), dashboard: r('dashboard/index.html') }
    }
  },
  server: { port: 5190 }
}))
