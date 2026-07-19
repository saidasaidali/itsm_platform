// backend/src/routes/reportStatsRoutes.js
// Routes pour les statistiques de rapports

import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  getAllStats,
  getAssetStats,
  getUserStats,
  getTicketStats,
  getSecurityStats,
  getNetworkStats,
  getAIStats,
  getPlatformStats,
  getFilters
} from '../controllers/reportStatsController.js';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// ── Statistiques globales ──────────────────────────────────────────────────────

// GET /api/reports/stats/all - Obtenir toutes les statistiques
router.get('/stats/all', getAllStats);

// GET /api/reports/stats/assets - Statistiques du parc informatique
router.get('/stats/assets', getAssetStats);

// GET /api/reports/stats/users - Statistiques des utilisateurs
router.get('/stats/users', getUserStats);

// GET /api/reports/stats/tickets - Statistiques des tickets
router.get('/stats/tickets', getTicketStats);

// GET /api/reports/stats/security - Statistiques de sécurité
router.get('/stats/security', getSecurityStats);

// GET /api/reports/stats/network - Statistiques de découverte réseau
router.get('/stats/network', getNetworkStats);

// GET /api/reports/stats/ai - Statistiques de l'assistant IA
router.get('/stats/ai', getAIStats);

// GET /api/reports/stats/platform - Statistiques d'activité plateforme
router.get('/stats/platform', getPlatformStats);

// ── Filtres disponibles ────────────────────────────────────────────────────────

// GET /api/reports/filters - Obtenir les filtres disponibles
router.get('/filters', getFilters);

export default router;