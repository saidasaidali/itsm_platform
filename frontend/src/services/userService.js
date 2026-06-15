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
})

// ─── Lecture ──────────────────────────────────────────────────────────────────
export const getUsers = async () => {
  const data = await api.get('/api/users')
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
  })
  return data.data
}

// ─── Mise à jour (Admin) ──────────────────────────────────────────────────────
export const updateUser = async (id, updates) => {
  const data = await api.put(`/api/users/${id}`, updates)
  return data.data
}

// ─── Validation / Désactivation d'un compte (Admin) ──────────────────────────
// status : 'active' | 'inactive' | 'pending'
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
  // Retournés dans l'ordre d'affichage — Admin en premier pour les formulaires admin
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