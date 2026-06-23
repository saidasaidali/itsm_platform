// frontend/src/services/dashboardService.js
import api from './api.js'

export const getRealtimeDashboard = async () => {
  const data = await api.get('/api/dashboard/realtime')
  return data.data
}

export const getNetworkMap = async () => {
  const data = await api.get('/api/dashboard/network-map')
  return data.data
}