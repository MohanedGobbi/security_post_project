// Supervisor dashboard demo: the real dashboard UI, its /api calls answered in the browser (VITE_DEMO).
import { mountDemoBar } from '../demo-bar'
import '../demo.css'

await import('@dashboard/main')
mountDemoBar('dashboard')
