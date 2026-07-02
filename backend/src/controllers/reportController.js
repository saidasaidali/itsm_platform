// backend/src/controllers/reportController.js
import { validationResult } from 'express-validator';
import { t } from '../utils/i18n.js';
import * as reportService from '../services/reportService.js';
import asyncHandler from '../middlewares/asyncHandler.js';

// ─── GET /api/reports — List all reports ─────────────────────────────────────
export const getReports = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const result = await reportService.getReportHistory(page, limit);

  return res.json({
    success: true,
    data: result.reports,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    }
  });
});

// ─── POST /api/reports/generate — Generate new report ────────────────────────
export const generateReport = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error('[generateReport] Validation errors:', errors.array());
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { role, id: userId } = req.user;
  if (role !== 'Admin') {
    console.error('[generateReport] Access denied for user:', userId, 'role:', role);
    return res.status(403).json({ success: false, message: t(req, 'access_denied') });
  }

  const { report_type, period_start, period_end } = req.body;

  // Log request details
  console.log('[generateReport] Request received:', {
    report_type,
    period_start,
    period_end,
    userId,
    timestamp: new Date().toISOString()
  });

  // Validate dates
  const startDate = new Date(period_start);
  const endDate = new Date(period_end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error('[generateReport] Invalid dates:', { period_start, period_end });
    return res.status(400).json({ success: false, message: t(req, 'invalid_dates') });
  }

  if (startDate > endDate) {
    console.error('[generateReport] Start date after end date:', { period_start, period_end });
    return res.status(400).json({ success: false, message: 'La date de début doit être antérieure à la date de fin' });
  }

  // Validate report type
  if (!['monthly', 'weekly', 'custom'].includes(report_type)) {
    console.error('[generateReport] Invalid report type:', report_type);
    return res.status(400).json({ success: false, message: 'Type de rapport invalide' });
  }

  console.log('[generateReport] Starting report generation...');
  // Generate report asynchronously
  const report = await reportService.generateReport(
    report_type,
    period_start,
    endDate.toISOString().split('T')[0],
    userId
  );

  console.log('[generateReport] Report generated successfully:', report.id);
  return res.status(201).json({
    success: true,
    message: t(req, 'report_generated_successfully'),
    data: report
  });
});

// ─── GET /api/reports/:id — Get report details ───────────────────────────────
export const getReportById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await req.app.locals.db.query(`
    SELECT r.*, u.username as generated_by_name
    FROM reports r
    LEFT JOIN users u ON r.generated_by = u.id
    WHERE r.id = $1
  `, [id]);

  if (!rows[0]) {
    return res.status(404).json({ success: false, message: t(req, 'report_not_found') });
  }

  return res.json({
    success: true,
    data: rows[0]
  });
});

// ─── DELETE /api/reports/:id — Delete report ─────────────────────────────────
export const deleteReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.user;

  if (role !== 'Admin') {
    return res.status(403).json({ success: false, message: t(req, 'access_denied') });
  }

  const deleted = await reportService.deleteReport(id);

  if (!deleted) {
    return res.status(404).json({ success: false, message: t(req, 'report_not_found') });
  }

  return res.json({
    success: true,
    message: t(req, 'report_deleted_successfully')
  });
});

// ─── GET /api/reports/download/:id — Download report PDF ─────────────────────
export const downloadReport = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await req.app.locals.db.query(
    'SELECT * FROM reports WHERE id = $1',
    [id]
  );

  if (!rows[0]) {
    return res.status(404).json({ success: false, message: t(req, 'report_not_found') });
  }

  const report = rows[0];

  if (report.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Ce rapport n\'est pas encore prêt pour téléchargement'
    });
  }

  if (!report.file_path) {
    return res.status(404).json({
      success: false,
      message: 'Fichier de rapport introuvable'
    });
  }

  // Check if file exists
  const fs = await import('fs/promises');
  try {
    await fs.access(report.file_path);
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: 'Fichier de rapport introuvable sur le serveur'
    });
  }

  // Send file
  const filename = `rapport_${report.report_type}_${report.period_start}_${report.period_end}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const fileStream = await import('fs');
  const readStream = fileStream.createReadStream(report.file_path);
  readStream.pipe(res);
});

// ─── GET /api/reports/:id/status — Check report generation status ─────────────
export const getReportStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await req.app.locals.db.query(
    'SELECT id, status, error_message, generated_at FROM reports WHERE id = $1',
    [id]
  );

  if (!rows[0]) {
    return res.status(404).json({ success: false, message: t(req, 'report_not_found') });
  }

  return res.json({
    success: true,
    data: rows[0]
  });
});