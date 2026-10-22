// Reception app demo: the real React UI of the desktop app, with window.api answered in the browser.
import type { Api } from '@shared/types'
import { demoApi } from '../reception-api'
import { mountDemoBar } from '../demo-bar'
import '../demo.css'

;(window as unknown as { api: Api }).api = demoApi
;(window as unknown as { __SECREG_DEMO__: boolean }).__SECREG_DEMO__ = true
await import('@renderer/main')
mountDemoBar()
