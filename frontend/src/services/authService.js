/**
 * authService.js — Authentification connectée à l'API backend
 */

import i18n from '../i18n'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const USER_KEY = 'itsm-auth-user'
const TOKEN_KEY = 'itsm-auth-token'

const getLang = () => localStorage.getItem('itsm-lang') || 'fr'

import { api } from './api'

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
  try {
    const data = await api.post('/api/auth/login', { identifier, password })
    saveAuthData(data.user, data.token)
    return data.user
  } catch (err) {
    throw new Error(err.message || i18n.t('api.login_invalid'))
  }
}

export const logout = async () => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    await api.post('/api/auth/logout', {}).catch(() => {})
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
  try {
    const data = await api.post('/api/auth/register', userData)
    return { user: data.user, message: data.message }
  } catch (err) {
    throw new Error(err.message || i18n.t('api.register_error'))
  }
}

export const forgotPassword = async (email) => {
  try {
    const data = await api.post('/api/auth/forgot-password', { email })
    return data
  } catch (err) {
    throw new Error(err.message || i18n.t('api.forgot_error'))
  }
}

export const checkResetToken = async (token) => {
  try {
    const data = await api.get(`/api/auth/reset-password/${token}`)
    return data
  } catch (err) {
    throw new Error(err.message || i18n.t('api.reset_invalid'))
  }
}

export const resetPassword = async (token, password) => {
  try {
    const data = await api.post(`/api/auth/reset-password/${token}`, { password })
    return data
  } catch (err) {
    throw new Error(err.message || i18n.t('api.reset_error'))
  }
}
