// frontend/src/services/recommendationService.js
import api from './api'

export const getTechnicianRecommendation = async (category, priority) => {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (priority) params.set('priority', priority)
  const data = await api.get(`/api/recommendations/technician?${params.toString()}`)
  return data.data
}

export const getTechnicianStats = async (technicianId) => {
  const data = await api.get(`/api/recommendations/technician/${technicianId}/stats`)
  return data.data
}