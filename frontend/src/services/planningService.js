// frontend/src/services/planningService.js
// Service de planning des techniciens

import api from './api.js';

export const PLANNING_PERIODS = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois'
};

/**
 * Récupère le planning de tous les techniciens
 */
export const getAllTechniciansPlanning = async (period = 'week') => {
  const data = await api.get(`/api/planning/technicians?period=${period}`);
  return data.data;
};

/**
 * Récupère le planning d'un technicien
 */
export const getTechnicianPlanning = async (id, period = 'week') => {
  const data = await api.get(`/api/planning/technicians/${id}?period=${period}`);
  return data.data;
};

/**
 * Récupère son propre planning
 */
export const getMyPlanning = async (period = 'week') => {
  const data = await api.get(`/api/planning/me?period=${period}`);
  return data.data;
};

/**
 * Détecte les conflits de planning
 */
export const getConflicts = async (date, technicianIds = []) => {
  let url = `/api/planning/conflicts?date=${date}`;
  if (technicianIds.length > 0) {
    url += `&technician_ids=${technicianIds.join(',')}`;
  }
  const data = await api.get(url);
  return data.data;
};

export default {
  getAllTechniciansPlanning,
  getTechnicianPlanning,
  getMyPlanning,
  getConflicts,
  PLANNING_PERIODS
};