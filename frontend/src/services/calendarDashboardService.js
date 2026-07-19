// frontend/src/services/calendarDashboardService.js
// Service pour le tableau de bord du calendrier
import api from './api.js'

export const getCalendarDashboard = async () => {
  const data = await api.get('/api/calendar/dashboard')
  return data.data
}

export default {
  getCalendarDashboard
}