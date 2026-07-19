// backend/src/controllers/planningController.js
// Contrôleur pour le planning des techniciens
import asyncHandler from '../middlewares/asyncHandler.js';
import { getTechnicianStats, getAllTechniciansPlanning, detectTeamConflicts } from '../services/calendarPlanningService.js';

// GET /api/planning/technicians
export const getAllTechnicians = asyncHandler(async (req, res) => {
  const { period = 'week' } = req.query;
  const plannings = await getAllTechniciansPlanning(period);
  return res.json({ success: true, data: plannings });
});

// GET /api/planning/technicians/:id
export const getTechnicianById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { period = 'week' } = req.query;
  const stats = await getTechnicianStats(parseInt(id), period);
  return res.json({ success: true, data: stats });
});

// GET /api/planning/me
export const getMyPlanning = asyncHandler(async (req, res) => {
  const { id } = req.user;
  const { period = 'week' } = req.query;
  const stats = await getTechnicianStats(id, period);
  return res.json({ success: true, data: stats });
});

// GET /api/planning/conflicts
export const getConflicts = asyncHandler(async (req, res) => {
  const { date, technician_ids } = req.query;
  if (!date) {
    return res.status(400).json({ success: false, message: 'La date est requise' });
  }
  const techIds = technician_ids ? technician_ids.split(',').map(Number) : [];
  const conflicts = await detectTeamConflicts(new Date(date), techIds);
  return res.json({ success: true, data: conflicts });
});

export default {
  getAllTechnicians,
  getTechnicianById,
  getMyPlanning,
  getConflicts
};