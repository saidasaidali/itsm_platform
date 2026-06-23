// frontend/src/services/settingsService.js
import api from './api'

// ─── Paramètres système (Admin) ────────────────────────────────────────────────
export const getSystemSettings = async () => {
  const data = await api.get('/api/settings/system')
  return data.settings
}

export const updateSystemSettings = async (updates) => {
  const data = await api.patch('/api/settings/system', updates)
  return data
}

// ─── Préférences utilisateur (tous rôles) ──────────────────────────────────────
export const getPreferences = async () => {
  const data = await api.get('/api/settings/preferences')
  return data.preferences
}

export const updatePreferences = async (updates) => {
  const data = await api.patch('/api/settings/preferences', updates)
  return data
}