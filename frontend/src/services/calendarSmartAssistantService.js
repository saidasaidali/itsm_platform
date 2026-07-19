// frontend/src/services/calendarSmartAssistantService.js
// Service pour le Smart Assistant du calendrier
import api from './api.js';

/**
 * Build a query string from an object of key/value pairs
 */
const buildQuery = (params) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      qs.append(key, value);
    }
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
};

/**
 * Suggère la meilleure date pour un événement
 */
export const suggestBestDate = async (params) => {
  const data = await api.get(`/api/calendar/smart-assistant/suggest-date${buildQuery(params)}`);
  return data.data;
};

/**
 * Détecte les conflits pour un créneau
 */
export const detectConflicts = async (start_date, end_date, assigned_to) => {
  const data = await api.get(`/api/calendar/smart-assistant/detect-conflicts${buildQuery({ start_date, end_date, assigned_to })}`);
  return data.data;
};

/**
 * Recommande le meilleur technicien
 */
export const recommendTechnician = async (event_type, start_date, end_date, department) => {
  const data = await api.get(`/api/calendar/smart-assistant/recommend-technician${buildQuery({ event_type, start_date, end_date, department })}`);
  return data.data;
};

/**
 * Suggère la meilleure durée
 */
export const suggestBestDuration = async (event_type, asset_id, description) => {
  const data = await api.get(`/api/calendar/smart-assistant/suggest-duration${buildQuery({ event_type, asset_id, description })}`);
  return data.data;
};

/**
 * Détecte les créneaux disponibles
 */
export const detectAvailableSlots = async (technician_id, start_date, end_date, duration_minutes = 60) => {
  const data = await api.get(`/api/calendar/smart-assistant/detect-available-slots${buildQuery({ technician_id, start_date, end_date, duration_minutes })}`);
  return data.data;
};

/**
 * Suggère une période de maintenance
 */
export const suggestMaintenancePeriod = async (asset_id, maintenance_type, duration_hours = 2) => {
  const data = await api.get(`/api/calendar/smart-assistant/suggest-maintenance/${asset_id}${buildQuery({ maintenance_type, duration_hours })}`);
  return data.data;
};

export default {
  suggestBestDate,
  detectConflicts,
  recommendTechnician,
  suggestBestDuration,
  detectAvailableSlots,
  suggestMaintenancePeriod
};
