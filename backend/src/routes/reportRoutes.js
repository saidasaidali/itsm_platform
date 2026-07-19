// backend/src/routes/reportRoutes.js
import express from 'express';
import { getReports, generateReport, getReportById, deleteReport, downloadReport, getReportStatus } from '../controllers/reportController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/reports - List all reports (Admin only)
router.get('/', getReports);

// POST /api/reports/generate - Generate new report (Admin only)
router.post('/generate', generateReport);

// GET /api/reports/:id - Get report details
router.get('/:id', getReportById);

// GET /api/reports/:id/status - Check report generation status
router.get('/:id/status', getReportStatus);

// DELETE /api/reports/:id - Delete report (Admin only)
router.delete('/:id', deleteReport);

// GET /api/reports/download/:id - Download report PDF
router.get('/download/:id', downloadReport);

export default router;