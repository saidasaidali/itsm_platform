// frontend/src/services/maintenanceService.js
import api from './api.js';

export const MAINTENANCE_TYPES = {
  monthly: { label: 'Mensuelle', color: '#17a2b8', months: 1 },
  quarterly: { label: 'Trimestrielle', color: '#28a745', months: 3 },
  yearly: { label: 'Annuelle', color: '#007bff', months: 12 },
  warranty: { label: 'Basée garantie', color: '#ffc107', months: 0 },
  usage: { label: 'Basée utilisation', color: '#6f42c1', months: 6 },
};

export const getConfigs = async () => {
  const data = await api.get('/api/maintenance/configs');
  return data.data;
};

export const getUpcoming = async (limit = 20) => {
  const data = await api.get(`/api/maintenance/upcoming?limit=${limit}`);
  return data.data;
};

export const configureMaintenance = async (assetId, config) => {
  const data = await api.post(`/api/maintenance/configure/${assetId}`, config);
  return data.data;
};

export const disableMaintenance = async (assetId) => {
  const data = await api.delete(`/api/maintenance/configure/${assetId}`);
  return data;
};

export const runScheduler = async () => {
  const data = await api.post('/api/maintenance/run-scheduler');
  return data.data;
};

export const autoConfigure = async () => {
  const data = await api.post('/api/maintenance/auto-configure');
  return data.data;
};

export default {
  getConfigs,
  getUpcoming,
  configureMaintenance,
  disableMaintenance,
  runScheduler,
  autoConfigure,
  MAINTENANCE_TYPES,
};