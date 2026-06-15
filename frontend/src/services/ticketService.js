// frontend/src/services/ticketService.js
import api from './api.js'

const mapTicket = (t) => ({
  id:           t.id,
  title:        t.title,
  description:  t.description,
  status:       t.status,
  priority:     t.priority,
  category:     t.category || '',
  assignedTo:   t.assigned_to_name || '',
  assignedToId: t.assigned_to || null,      // ← ID numérique pour comparaisons
  createdBy:    t.created_by_name || '',
  createdById:  t.created_by || null,       // ← ID numérique pour comparaisons
  dueDate:      t.due_date    ? new Date(t.due_date).toLocaleString('fr-FR')    : '',
  resolvedAt:   t.resolved_at ? new Date(t.resolved_at).toLocaleString('fr-FR') : '',
  createdAt:    t.created_at  ? new Date(t.created_at).toLocaleDateString('fr-FR')  : '',
  updatedAt:    t.updated_at  ? new Date(t.updated_at).toLocaleDateString('fr-FR')  : '',
  comments: (t.comments || []).map((c) => ({
    id:         c.id,
    author:     c.author_name || '?',
    message:    c.message,
    isInternal: c.is_internal || false,
    createdAt:  c.created_at,
  })),
  history: (t.history || []).map((h) => ({
    id:       h.id,
    actor:    h.actor_name || '?',
    action:   h.action,
    oldValue: h.old_value,
    newValue: h.new_value,
    createdAt: h.created_at,
  })),
})

export const getTickets = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString()
  const data = await api.get(`/api/tickets${params ? `?${params}` : ''}`)
  return data.data.map(mapTicket)
}

export const getTicketById = async (id) => {
  const data = await api.get(`/api/tickets/${id}`)
  return mapTicket(data.data)
}

export const createTicket = async (ticket) => {
  const data = await api.post('/api/tickets', {
    title:       ticket.title,
    description: ticket.description,
    priority:    ticket.priority,
    category:    ticket.category,
    asset_id:    ticket.assetId ? parseInt(ticket.assetId) : null, // ← nouveau
  })
  return data.data
}

export const updateTicket = async (id, updates) => {
  const data = await api.put(`/api/tickets/${id}`, {
    title:       updates.title,
    description: updates.description,
    priority:    updates.priority,
    category:    updates.category,
  })
  return data.data
}

export const updateTicketStatus = async (id, status) => {
  const data = await api.patch(`/api/tickets/${id}/status`, { status })
  return data
}

export const assignTicket = async (id, technicianId) => {
  const data = await api.patch(`/api/tickets/${id}/assign`, { technicianId: Number(technicianId) })
  return data
}

export const transferTicket = async (id, technicianId) => {
  const data = await api.patch(`/api/tickets/${id}/transfer`, { technicianId: Number(technicianId) })
  return data
}

export const addComment = async (id, message, is_internal = false) => {
  const data = await api.post(`/api/tickets/${id}/comments`, { message, is_internal })
  return data.data
}

export const getTicketStats = async () => {
  const data = await api.get('/api/tickets/stats')
  const s = data.data
  return {
    total:      parseInt(s.total      || 0),
    open:       parseInt(s.open       || 0),
    inProgress: parseInt(s.in_progress|| 0),
    resolved:   parseInt(s.resolved   || 0),
    closed:     parseInt(s.closed     || 0),
  }
}

// Tickets liés à un équipement
export const getTicketsByAsset = async (assetId) => {
  const data = await api.get(`/api/tickets/asset/${assetId}`)
  return data.data.map(mapTicket)
}

// Alertes fiabilité (équipements avec 3+ pannes en 6 mois)
export const getReliabilityAlerts = async () => {
  const data = await api.get('/api/tickets/reliability')
  return data.data
}