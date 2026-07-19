// backend/src/controllers/calendarSmartAssistantController.js
// Express route handlers for the Smart Assistant planning intelligence
import { t } from '../utils/i18n.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import {
  suggestBestDate as suggestBestDateService,
  detectConflicts as detectConflictsService,
  recommendTechnician as recommendTechnicianService,
  suggestMaintenancePeriod as suggestMaintenancePeriodService,
  detectAvailableSlots as detectAvailableSlotsService,
  suggestBestDuration as suggestBestDurationService
} from '../services/calendarSmartAssistant.js';

// GET /api/calendar/smart-assistant/suggest-date
export const suggestBestDate = asyncHandler(async (req, res) => {
  const { event_type, duration_hours, assigned_to, department, preferred_date, asset_id } = req.query;
  
  const result = await suggestBestDateService({
    event_type,
    duration_hours: duration_hours ? parseFloat(duration_hours) : 2,
    assigned_to: assigned_to ? parseInt(assigned_to) : null,
    department,
    preferred_date,
    asset_id: asset_id ? parseInt(asset_id) : null
  });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  return res.json({ success: true, data: result });
});

// GET /api/calendar/smart-assistant/detect-conflicts
export const detectConflicts = asyncHandler(async (req, res) => {
  const { start_date, end_date, assigned_to } = req.query;

  if (!start_date || !end_date || !assigned_to) {
    return res.status(400).json({
      success: false,
      message: t(req, 'missing_required_params')
    });
  }

  const result = await detectConflictsService(
    start_date,
    end_date,
    parseInt(assigned_to)
  );

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  return res.json({ success: true, data: result });
});

// GET /api/calendar/smart-assistant/recommend-technician
export const recommendTechnician = asyncHandler(async (req, res) => {
  const { event_type, start_date, end_date, department } = req.query;

  if (!event_type || !start_date || !end_date) {
    return res.status(400).json({
      success: false,
      message: t(req, 'missing_required_params')
    });
  }

  const result = await recommendTechnicianService(
    event_type,
    start_date,
    end_date,
    department || null
  );

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  return res.json({ success: true, data: result });
});

// GET /api/calendar/smart-assistant/suggest-duration
export const suggestBestDuration = asyncHandler(async (req, res) => {
  const { event_type, asset_id, description } = req.query;

  if (!event_type) {
    return res.status(400).json({
      success: false,
      message: t(req, 'missing_required_params')
    });
  }

  const result = await suggestBestDurationService(
    event_type,
    asset_id ? parseInt(asset_id) : null,
    description || null
  );

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  return res.json({ success: true, data: result });
});

// GET /api/calendar/smart-assistant/detect-available-slots
export const detectAvailableSlots = asyncHandler(async (req, res) => {
  const { technician_id, start_date, end_date, duration_minutes } = req.query;

  if (!technician_id) {
    return res.status(400).json({
      success: false,
      message: t(req, 'missing_required_params')
    });
  }

  const result = await detectAvailableSlotsService(
    parseInt(technician_id),
    start_date || null,
    end_date || null,
    duration_minutes ? parseInt(duration_minutes) : 60
  );

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  return res.json({ success: true, data: result });
});

// GET /api/calendar/smart-assistant/suggest-maintenance/:asset_id
export const suggestMaintenancePeriod = asyncHandler(async (req, res) => {
  const { asset_id } = req.params;
  const { maintenance_type, duration_hours } = req.query;

  if (!asset_id) {
    return res.status(400).json({
      success: false,
      message: t(req, 'missing_required_params')
    });
  }

  const result = await suggestMaintenancePeriodService(
    parseInt(asset_id),
    maintenance_type || 'preventive',
    duration_hours ? parseFloat(duration_hours) : 2
  );

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  return res.json({ success: true, data: result });
});