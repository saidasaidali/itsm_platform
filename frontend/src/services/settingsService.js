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

// ─── Mode Simulation (Mock Mode) ──────────────────────────────────────────────
// @mode simulation - Vérifie si le mode simulation est activé
// Retourne true si les données simulées doivent être utilisées
export const isSimulationMode = async () => {
  try {
    const settings = await getSystemSettings()
    return settings.simulation_mode === true || settings.simulation_mode === 'true'
  } catch (err) {
    // Fallback sur la variable d'environnement si l'API n'est pas disponible
    return import.meta.env.VITE_SIMULATION_MODE === 'true'
  }
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
