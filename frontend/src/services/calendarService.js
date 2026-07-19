// frontend/src/services/calendarService.js
import api from './api.js';

// Types d'événements avec leurs couleurs par défaut
export const EVENT_TYPES = {
  intervention_technique: { label: 'Intervention technique', color: '#dc3545' },
  maintenance_preventive: { label: 'Maintenance préventive', color: '#28a745' },
  maintenance_corrective: { label: 'Maintenance corrective', color: '#ffc107' },
  deploiement: { label: 'Déploiement', color: '#17a2b8' },
  installation_equipement: { label: 'Installation équipement', color: '#6f42c1' },
  reunion: { label: 'Réunion', color: '#007bff' },
  formation: { label: 'Formation', color: '#20c997' },
  incident_critique: { label: 'Incident critique', color: '#dc3545' },
  astreinte: { label: 'Astreinte', color: '#fd7e14' },
  autre: { label: 'Autre', color: '#6c757d' }
};

// Statuts d'événements
export const EVENT_STATUSES = {
  scheduled: 'Planifié',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
  postponed: 'Reporté'
};

// Récupérer tous les événements
export const getEvents = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  const data = await api.get(`/api/calendar/events${params.toString() ? `?${params.toString()}` : ''}`);
  return data.data;
};

// Récupérer un événement par ID
export const getEventById = async (id) => {
  const data = await api.get(`/api/calendar/events/${id}`);
  return data.data;
};

// Créer un événement
export const createEvent = async (event) => {
  const data = await api.post('/api/calendar/events', event);
  return data.data;
};

// Modifier un événement
export const updateEvent = async (id, event) => {
  const data = await api.put(`/api/calendar/events/${id}`, event);
  return data.data;
};

// Supprimer un événement
export const deleteEvent = async (id) => {
  const data = await api.delete(`/api/calendar/events/${id}`);
  return data.data;
};

// Récupérer les statistiques
export const getStats = async () => {
  const data = await api.get('/api/calendar/stats');
  return data.data;
};

// Récupérer les événements d'un ticket
export const getEventsByTicket = async (ticketId) => {
  const data = await api.get(`/api/calendar/events?ticket_id=${ticketId}`);
  return data.data;
};

// Récupérer les événements d'un équipement
export const getEventsByAsset = async (assetId) => {
  const data = await api.get(`/api/calendar/events?asset_id=${assetId}`);
  return data.data;
};

// Récupérer les événements d'un utilisateur
export const getEventsByUser = async (userId) => {
  const data = await api.get(`/api/calendar/events?assigned_to=${userId}`);
  return data.data;
};

// Dupliquer un événement
export const duplicateEvent = async (id) => {
  const data = await api.post(`/api/calendar/events/${id}/duplicate`);
  return data.data;
};

// Récupérer les participants d'un événement
export const getEventParticipants = async (eventId) => {
  const data = await api.get(`/api/calendar/events/${eventId}/participants`);
  return data.data;
};

// Ajouter un participant
export const addParticipant = async (eventId, userId) => {
  const data = await api.post(`/api/calendar/events/${eventId}/participants`, { user_id: userId });
  return data.data;
};

// Supprimer un participant
export const removeParticipant = async (eventId, userId) => {
  const data = await api.delete(`/api/calendar/events/${eventId}/participants/${userId}`);
  return data.data;
};

// Mettre à jour le statut d'un participant
export const updateParticipantStatus = async (eventId, userId, status) => {
  const data = await api.put(`/api/calendar/events/${eventId}/participants/${userId}`, { status });
  return data.data;
};

// Récupérer les événements automatiques (garanties, maintenances, anomalies, pannes)
export const getAutoEvents = async () => {
  const data = await api.get('/api/calendar/auto-events');
  return data.data;
};

// ─── Smart Assistant - Intelligence Planning ─────────────────

// Suggérer la meilleure date pour un événement
export const suggestBestDate = async (params) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.append(key, value);
  });
  const data = await api.get(`/api/calendar/smart-assistant/suggest-date?${query.toString()}`);
  return data.data;
};

// Détecter les conflits de planning
export const detectConflicts = async (start_date, end_date, assigned_to) => {
  const query = new URLSearchParams({ start_date, end_date, assigned_to });
  const data = await api.get(`/api/calendar/smart-assistant/detect-conflicts?${query.toString()}`);
  return data.data;
};

// Recommander un technicien disponible
export const recommendTechnician = async (event_type, start_date, end_date, department) => {
  const query = new URLSearchParams({ event_type, start_date, end_date });
  if (department) query.append('department', department);
  const data = await api.get(`/api/calendar/smart-assistant/recommend-technician?${query.toString()}`);
  return data.data;
};

// Suggérer une période de maintenance
export const suggestMaintenancePeriod = async (asset_id, maintenance_type, duration_hours) => {
  const query = new URLSearchParams({ maintenance_type, duration_hours });
  const data = await api.get(`/api/calendar/smart-assistant/suggest-maintenance/${asset_id}?${query.toString()}`);
  return data.data;
};
