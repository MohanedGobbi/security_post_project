import { defineConfig } from 'vite'

// Static landing page for the faculty security program: everything is bundled (fonts, three, gsap),
// so the built folder works from a USB stick or a laptop with no network.
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { port: 5191 }
})
