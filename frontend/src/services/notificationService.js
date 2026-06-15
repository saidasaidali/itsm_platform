// src/services/notificationService.js
import api from './api.js'

const mapNotif = (n) => ({
  id:        n.id,
  title:     n.title,
  message:   n.message,
  read:      n.read,
  createdAt: n.created_at,
})

export const getNotifications = async () => {
  const data = await api.get('/api/notifications')
  return data.data.map(mapNotif)
}

export const getUnreadCount = async () => {
  const data = await api.get('/api/notifications/unread-count')
  return data.count || 0
}

export const markNotificationRead = async (id) => {
  const data = await api.put(`/api/notifications/${id}/read`)
  return data.data
}

export const markAllRead = async () => {
  await api.put('/api/notifications/read-all')
}

export const deleteNotification = async (id) => {
  await api.delete(`/api/notifications/${id}`)
}

export const getPreferences = async () => {
  const data = await api.get('/api/notifications/preferences')
  return data.data
}

export const updatePreferences = async (prefs) => {
  const data = await api.put('/api/notifications/preferences', prefs)
  return data.data
}