// src/services/userService.js — Gestion des utilisateurs via l'API backend
import api from './api.js'

// ─── Mapping interne ──────────────────────────────────────────────────────────
const mapUser = (u) => ({
  id:        u.id,
  username:  u.username,           
  name:      u.username,
  email:     u.email,
  role:      u.role_name || u.role,
  role_name: u.role_name || u.role, 
  role_id:   u.role_id,
  status:    u.status || 'active',
  direction: u.direction || '',
  division:  u.division || '',
  service:   u.service || '',
})

// ─── Lecture ──────────────────────────────────────────────────────────────────
export const getUsers = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString()
  const data = await api.get(`/api/users${params ? `?${params}` : ''}`)
  return data.data.map(mapUser)
}

export const getUserById = async (id) => {
  const data = await api.get(`/api/users/${id}`)
  return mapUser(data.data)
}

// ─── Création (Admin) ─────────────────────────────────────────────────────────
export const createUser = async (user) => {
  const data = await api.post('/api/users', {
    username: user.name || user.username,
    email: user.email,
    password: user.password,
    role_id: user.role_id,
    direction: user.direction || null,
    division: user.division || null,
    service: user.service || null,
  })
  return data.data
}

// ─── Mise à jour (Admin) ──────────────────────────────────────────────────────
export const updateUser = async (id, updates) => {
  const data = await api.put(`/api/users/${id}`, updates)
  return data.data
}

// ─── Validation / Désactivation d'un compte (Admin) ──────────────────────────
export const updateUserStatus = async (id, status) => {
  const data = await api.patch(`/api/users/${id}/status`, { status })
  return data.data
}

// ─── Suppression (Admin) ──────────────────────────────────────────────────────
export const deleteUser = async (id) => {
  const data = await api.delete(`/api/users/${id}`)
  return data
}

// ─── Rôles disponibles ────────────────────────────────────────────────────────
export const getRoles = async () => {
  return [
    { id: 1, label: 'Admin' },
    { id: 2, label: 'Technicien' },
    { id: 3, label: 'Agent' },
  ]
}

// ─── Statistiques ─────────────────────────────────────────────────────────────
export const getUserStats = async () => {
  const users = await getUsers()
  return {
    total: users.length,
    admins: users.filter((u) => u.role === 'Admin').length,
    pending: users.filter((u) => u.status === 'pending').length,
    inactive: users.filter((u) => u.status === 'inactive').length,
  }
}

// ─── Services disponibles ──────────────────────────────────────────────────────
export const getServices = async () => {
  const data = await api.get('/api/users/services')
  return data.data
}

export const adminResetPassword = async (id) => {
  const data = await api.patch(`/api/users/${id}/reset-password`);
  return data;
};

// Récupère les techniciens actifs - accessible aux rôles Admin et Technicien
export const getActiveTechnicians = async () => {
  const data = await api.get('/api/users/technicians')
  return data.data
}

// Récupère tous les utilisateurs actifs - accessible à tous les rôles connectés
export const getActiveUsers = async () => {
  // Utilise l'endpoint /api/users avec filtres accessibles
  const data = await api.get('/api/users/technicians')
  return data.data
}

export const importUsersFromExcel = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('itsm-auth-token')
  const API_URL = (typeof window !== 'undefined' && window.__ITSM_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:3000'

  const response = await fetch(`${API_URL}/api/users/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Erreur lors de l\'import.')
  return data
}