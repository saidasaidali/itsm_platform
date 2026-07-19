// backend/src/controllers/maintenanceController.js
// Contrôleur pour la maintenance préventive
import asyncHandler from '../middlewares/asyncHandler.js';
import {
  configureMaintenance,
  disableMaintenance,
  runMaintenanceScheduler,
  getAllMaintenanceConfigs,
  getUpcomingMaintenances,
  autoConfigureAllAssets,
} from '../services/calendarMaintenanceService.js';

// GET /api/maintenance/configs
export const getConfigs = asyncHandler(async (req, res) => {
  const configs = await getAllMaintenanceConfigs();
  return res.json({ success: true, data: configs });
});

// GET /api/maintenance/upcoming
export const getUpcoming = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const events = await getUpcomingMaintenances(limit);
  return res.json({ success: true, data: events });
});

// POST /api/maintenance/configure/:assetId
export const configure = asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  const config = await configureMaintenance(parseInt(assetId), req.body);
  return res.json({ success: true, data: config, message: 'Configuration de maintenance créée/mise à jour' });
});

// DELETE /api/maintenance/configure/:assetId
export const remove = asyncHandler(async (req, res) => {
  const { assetId } = req.params;
  await disableMaintenance(parseInt(assetId));
  return res.json({ success: true, message: 'Maintenance désactivée pour cet équipement' });
});

// POST /api/maintenance/run-scheduler
export const runScheduler = asyncHandler(async (req, res) => {
  const count = await runMaintenanceScheduler();
  return res.json({ success: true, data: { eventsCreated: count } });
});

// POST /api/maintenance/auto-configure
export const autoConfigure = asyncHandler(async (req, res) => {
  const count = await autoConfigureAllAssets();
  return res.json({ success: true, data: { configured: count } });
});

export default {
  getConfigs,
  getUpcoming,
  configure,
  remove,
  runScheduler,
  autoConfigure
};