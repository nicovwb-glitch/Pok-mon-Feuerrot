import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Der Service Worker gehört nur zur veröffentlichten Webseite. Die Electron-App
// lädt ihr bereits vollständig eingebautes Paket über das feuerrot:-Protokoll.
if ('serviceWorker' in navigator && import.meta.env.PROD && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
  })
}
