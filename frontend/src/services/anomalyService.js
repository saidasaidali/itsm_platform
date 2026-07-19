// frontend/src/services/anomalyService.js
import api from './api.js'

const mapAnomaly = (a) => ({
  id:           a.id,
  assetId:      a.asset_id,
  assetTag:     a.asset_tag,
  brand:        a.brand,
  model:        a.model,
  type:         a.anomaly_type,
  severity:     a.severity,
  description:  a.description,
  details:      a.details || {},
  status:       a.status,
  detectedAt:   a.detected_at,
  resolvedAt:   a.resolved_at,
  resolvedBy:   a.resolved_by_name,
})

export const getAnomalies = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString()
  const data = await api.get(`/api/anomalies${params ? `?${params}` : ''}`)
  return data.data.map(mapAnomaly)
}

export const getUnknownDevices = async () => {
  const data = await api.get('/api/anomalies/unknown-devices')
  return data.data
}

export const resolveAnomaly = async (id, status) => {
  const data = await api.patch(`/api/anomalies/${id}/resolve`, { status })
  return data.data
}

export const getAnomalyStats = async () => {
  const data = await api.get('/api/anomalies/stats')
  return data.data
}