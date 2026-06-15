/**
 * api.js — Client HTTP centralisé
 * Toutes les requêtes passent par ce module qui injecte automatiquement le JWT.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const TOKEN_KEY = 'itsm-auth-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)

const buildHeaders = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
})

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`)
  return data
}

export const api = {
  get: (path) =>
    fetch(`${API_URL}${path}`, { headers: buildHeaders() }).then(handleResponse),

  post: (path, body) =>
    fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

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
}

export default api