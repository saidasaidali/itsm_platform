/**
 * api.js — Client HTTP centralisé
 * Toutes les requêtes passent par ce module qui injecte automatiquement le JWT.
 */

import i18n from '../i18n'

// Permettre l'injection d'une URL API au runtime (ex: via <script> qui définit window.__ITSM_API_URL)
// En développement: le proxy Vite redirige /api vers http://localhost:3000
// En production: utiliser VITE_API_URL ou une URL absolue
const API_URL = (typeof window !== 'undefined' && window.__ITSM_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:3000'
const TOKEN_KEY = 'itsm-auth-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)

const getLang = () => localStorage.getItem('itsm-lang') || 'fr'

const buildHeaders = (extra = {}) => ({
  'Content-Type': 'application/json',
  'Accept-Language': getLang(),
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
})

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Gestion spéciale des 401 : déconnexion automatique
    if (res.status === 401) {
      localStorage.removeItem('itsm-auth-token')
      localStorage.removeItem('itsm-auth-user')
      // Redirection vers login si on n'y est pas déjà
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    throw new Error(data.message || i18n.t('api.http_error', { status: res.status }))
  }
  // Garantir que data.data existe toujours pour éviter les erreurs "Cannot read properties of undefined"
  return { ...data, data: data.data || {} }
}

export const api = {
  get: (path) =>
    fetch(`${API_URL}${path}`, { headers: buildHeaders() }).then(handleResponse),

  post: (path, body, options = {}) => {
    const isFormData = body instanceof FormData
    const headers = isFormData 
      ? { 
          'Accept-Language': getLang(),
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          ...options.headers,
        }
      : buildHeaders()
    
    return fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: isFormData ? body : JSON.stringify(body),
    }).then(handleResponse)
  },

  put: (path, body) =>
    fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  patch: (path, body) =>
    fetch(`${API_URL}${path}`, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  delete: (path) =>
    fetch(`${API_URL}${path}`, { method: 'DELETE', headers: buildHeaders() }).then(handleResponse),

  upload: (path, file, fieldName = 'file') => {
    const formData = new FormData()
    formData.append(fieldName, file)
    return api.post(path, formData)
  },
}

export default api