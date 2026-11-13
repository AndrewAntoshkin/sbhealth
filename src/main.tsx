import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/onest/wght.css'
import { App } from './App'
import './styles.css'
import './theme.css'
import './screens.css'
import './flow.css'
import './system.css'
import './start.css'
import { registerSW } from 'virtual:pwa-register'
import { initTypo } from './typo'

// Service worker качает весь кэш (≈4 МБ) — не отбираем у модели канал: стартуем, когда тело уже на экране.
let swStarted = false
const startSW = () => {
  if (swStarted) return
  swStarted = true
  registerSW({ immediate: true })
}
window.addEventListener('atlas-ready', () => setTimeout(startSW, 1200), { once: true })
setTimeout(startSW, 30000)

initTypo()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
