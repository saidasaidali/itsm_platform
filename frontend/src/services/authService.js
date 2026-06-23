/**
 * authService.js — Authentification connectée à l'API backend
 */

import i18n from '../i18n'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const USER_KEY = 'itsm-auth-user'
const TOKEN_KEY = 'itsm-auth-token'

const getLang = () => localStorage.getItem('itsm-lang') || 'fr'

const authHeaders = (extra = {}) => ({
  'Content-Type': 'application/json',
  'Accept-Language': getLang(),
  ...extra,
})

const clearAuthData = () => {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

const saveAuthData = (user, token) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  localStorage.setItem(TOKEN_KEY, token)
}

const parseJwt = (token) => {
  try {
    const base64Payload = token.split('.')[1]
    const jsonPayload = decodeURIComponent(
      atob(base64Payload)
        .split('')
        .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(''),
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

const isTokenValid = (token) => {
  if (!token) return false
  const payload = parseJwt(token)
  if (!payload?.exp) return false
  return payload.exp * 1000 > Date.now()
}

export const login = async ({ identifier, password }) => {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ identifier, password }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || i18n.t('api.login_invalid'))
  saveAuthData(data.user, data.token)
  return data.user
}

export const logout = async () => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: authHeaders({ Authorization: `Bearer ${token}` }),
    }).catch(() => {})
  }
  clearAuthData()
}

export const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY)
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token || !raw || !isTokenValid(token)) {
      clearAuthData()
      return null
    }
    return JSON.parse(raw)
  } catch {
    clearAuthData()
    return null
  }
}

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY)

export const register = async (userData) => {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(userData),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || i18n.t('api.register_error'))
  return { user: data.user, message: data.message }
}

export const forgotPassword = async (email) => {
  const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || i18n.t('api.forgot_error'))
  return data
}

export const checkResetToken = async (token) => {
  const response = await fetch(`${API_URL}/api/auth/reset-password/${token}`, {
    method: 'GET',
    headers: authHeaders(),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || i18n.t('api.reset_invalid'))
  return data
}

export const resetPassword = async (token, password) => {
  const response = await fetch(`${API_URL}/api/auth/reset-password/${token}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ password }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || i18n.t('api.reset_error'))
  return data
}
