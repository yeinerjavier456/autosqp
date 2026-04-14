import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import 'sweetalert2/dist/sweetalert2.min.css'
import './index.css'
import App from './App.jsx'

const OLD_ORIGIN = 'https://autosqp.co'
const CANONICAL_ORIGIN = 'https://autosqp.com'

axios.interceptors.request.use((config) => {
  if (typeof config.url === 'string' && config.url.startsWith(OLD_ORIGIN)) {
    config.url = config.url.replace(OLD_ORIGIN, CANONICAL_ORIGIN)
  }

  return config
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
