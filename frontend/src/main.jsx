import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import 'sweetalert2/dist/sweetalert2.min.css'
import './index.css'
import App from './App.jsx'

const LEGACY_ORIGINS = new Set([
  'https://autosqp.co',
  'https://www.autosqp.co',
  'https://autosqp.com',
  'https://www.autosqp.com',
])

const API_BASE_PATH = '/crm/api'
const API_BASE_URL = `${window.location.origin}${API_BASE_PATH}`

const normalizeApiUrl = (rawUrl) => {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return rawUrl
  }

  const url = rawUrl.trim()

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsedUrl = new URL(url)
      if (!LEGACY_ORIGINS.has(parsedUrl.origin)) {
        return url
      }

      let normalizedPath = parsedUrl.pathname
      if (normalizedPath.startsWith('/crm/api/')) {
        normalizedPath = normalizedPath.replace('/crm/api/', '/')
      } else if (normalizedPath.startsWith('/api/')) {
        normalizedPath = normalizedPath.replace('/api/', '/')
      }

      return `${API_BASE_URL}${normalizedPath}${parsedUrl.search}${parsedUrl.hash}`
    } catch {
      return url
    }
  }

  if (url.startsWith('/crm/api/')) {
    return `${API_BASE_URL}${url.replace('/crm/api/', '/')}`
  }

  if (url.startsWith('/api/')) {
    return `${API_BASE_URL}${url.replace('/api/', '/')}`
  }

  if (url.startsWith('api/')) {
    return `${API_BASE_URL}/${url.slice(4)}`
  }

  if (url.startsWith('/')) {
    return `${API_BASE_URL}${url}`
  }

  return `${API_BASE_URL}/${url}`
}

axios.defaults.baseURL = API_BASE_URL

axios.interceptors.request.use((config) => {
  config.url = normalizeApiUrl(config.url)

  return config
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
