import '@fontsource/cairo/400.css'
import '@fontsource/cairo/600.css'
import '@fontsource/cairo/700.css'
// same look as the reception app
import '@desktop/styles.css'
import './dashboard.css'
import '@desktop/i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
