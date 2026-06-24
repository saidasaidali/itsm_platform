// src/services/assetService.js
import api from './api.js'

const mapAsset = (a) => ({
  id:             a.id,
  assetTag:       a.asset_tag,
  type:           a.type,
  brand:          a.brand,
  model:          a.model,
  status:         a.status,
  location:       a.location       || '',
  assignedTo:     a.assigned_to_name || '',
  assignedToId:   a.assigned_to    || null,
  assignedAt:     a.assigned_at    ? new Date(a.assigned_at).toLocaleString('fr-FR') : '',
  department:     a.department     || '',
  office:         a.office         || '',
  serialNumber:   a.serial_number  || '',
  purchaseDate:   a.purchase_date  ? a.purchase_date.split('T')[0] : '',
  warrantyEnd:    a.warranty_end   ? a.warranty_end.split('T')[0]  : '',
  createdAt:      a.created_at     ? a.created_at.split('T')[0]    : '',
  updatedAt:      a.updated_at     ? a.updated_at.split('T')[0]    : '',
})

export const getAssets = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString()
  const data = await api.get(`/api/assets${params ? `?${params}` : ''}`)
  return data.data.map(mapAsset)
}

export const getAssetById = async (id) => {
  const data = await api.get(`/api/assets/${id}`)
  const a = data.data
  return {
    ...mapAsset(a),
    history: (a.history || []).map((h) => ({
      id:         h.id,
      actionType: h.action_type,
      action:     h.action,
      actor:      h.actor_name || '—',
      oldValue:   h.old_value,
      newValue:   h.new_value,
      createdAt:  h.created_at,
    })),
    tickets: (a.tickets || []).map((t) => ({
      id:        t.id,
      title:     t.title,
      status:    t.status,
      priority:  t.priority,
      createdBy: t.created_by_name,
      createdAt: t.created_at?.split('T')[0],
    })),
  }
}

export const createAsset = async (asset) => {
  const data = await api.post('/api/assets', {
    asset_tag:     asset.assetTag || asset.asset_tag,
    type:          asset.type,
    brand:         asset.brand,
    model:         asset.model,
    status:        asset.status,
    location:      asset.location      || null,
    assigned_to:   asset.assignedToId  || null,
    serial_number: asset.serialNumber  || null,
    department:    asset.department    || null,
    office:        asset.office        || null,
    purchase_date: asset.purchaseDate  || null,
    warranty_end:  asset.warrantyEnd   || null,
  })
  return data.data
}

export const updateAsset = async (id, updates) => {
  const data = await api.put(`/api/assets/${id}`, {
    asset_tag:     updates.assetTag     || updates.asset_tag,
    type:          updates.type,
    brand:         updates.brand,
    model:         updates.model,
    status:        updates.status,
    location:      updates.location     || null,
    assigned_to:   updates.assignedToId ?? null,
    serial_number: updates.serialNumber || null,
    department:    updates.department   || null,
    office:        updates.office       || null,
    purchase_date: updates.purchaseDate || null,
    warranty_end:  updates.warrantyEnd  || null,
  })
  return data.data
}

export const assignAsset = async (id, { userId, department, office }) => {
  const data = await api.patch(`/api/assets/${id}/assign`, {
    user_id:    userId    || null,
    department: department || null,
    office:     office     || null,
  })
  return data.data
}

export const getAssetCounts = async () => {
  const data = await api.get('/api/assets/stats')
  const s = data.data
  return {
    total:            parseInt(s.total),
    inService:        parseInt(s.in_service),
    offline:          parseInt(s.offline),
    expiringWarranty: parseInt(s.expiring_warranty),
  }
}

export const getWarrantyAlerts = async () => {
  const data = await api.get('/api/assets/warranty-alerts')
  return data.data.map((a) => ({
    ...mapAsset(a),
    daysRemaining: parseInt(a.days_remaining),
  }))
}

export const deleteAsset = async (id) => {
  await api.delete(`/api/assets/${id}`)
}
