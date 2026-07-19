// frontend/src/services/smartCmdbService.js
import api from './api.js'

export const getAssetTwin = async (assetId) => {
  const data = await api.get(`/api/cmdb/asset/${assetId}/twin`)
  return data.data
}

export const getUserNetworkMap = async (userId) => {
  const data = await api.get(`/api/cmdb/user/${userId}/map`)
  return data.data
}

export const getLiveDashboard = async () => {
  const data = await api.get('/api/cmdb/dashboard')
  return data.data
}

export const refreshLiveStates = async () => {
  const data = await api.post('/api/cmdb/refresh-live')
  return data.data
}