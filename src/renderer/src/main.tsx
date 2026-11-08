import '@fontsource/cairo/400.css'
import '@fontsource/cairo/600.css'
import '@fontsource/cairo/700.css'
import './styles.css'
import './i18n'
import { applyBrand } from './brand'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installRemoteApi } from './remoteApi'

// in the dean's browser there is no program window to carry the calls: they go to the security PC
installRemoteApi()
applyBrand()
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
