// backend/src/routes/smartAssistantRoutes.js
// Routes pour le Smart IT Assistant
import express from 'express';
import { 
  processSmartMessage, 
  getStats, 
  getSecurityIncidents, 
  updateSecurityIncident,
  getSessionHistory,
  getRealtimeMetrics,
  analyzeMessage,
  syncLearnedCases
} from '../controllers/smartAssistantController.js';
import { authenticate as authMiddleware } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/smart-assistant/chat
 * @desc    Traiter un message avec le Smart Assistant (pipeline complet)
 * @access  Private
 */
router.post('/chat', authMiddleware, processSmartMessage);

/**
 * @route   POST /api/smart-assistant/analyze
 * @desc    Analyser un message sans créer de ticket (prévisualisation)
 * @access  Private
 */
router.post('/analyze', authMiddleware, analyzeMessage);

/**
 * @route   GET /api/smart-assistant/stats
 * @desc    Obtenir les statistiques du Smart Assistant
 * @access  Private (Admin)
 */
router.get('/stats', authMiddleware, getStats);

/**
 * @route   GET /api/smart-assistant/metrics/realtime
 * @desc    Obtenir les métriques en temps réel
 * @access  Private (Admin)
 */
router.get('/metrics/realtime', authMiddleware, getRealtimeMetrics);

/**
 * @route   GET /api/smart-assistant/security-incidents
 * @desc    Obtenir les incidents de sécurité actifs
 * @access  Private (Admin)
 */
router.get('/security-incidents', authMiddleware, getSecurityIncidents);

/**
 * @route   PATCH /api/smart-assistant/security-incidents/:id
 * @desc    Mettre à jour le statut d'un incident de sécurité
 * @access  Private (Admin)
 */
router.patch('/security-incidents/:id', authMiddleware, updateSecurityIncident);

/**
 * @route   POST /api/smart-assistant/sync
 * @desc    Synchroniser en masse les cas appris (tickets résolus + articles KB)
 * @access  Private (Admin)
 */
router.post('/sync', authMiddleware, authorize('Admin'), syncLearnedCases);

/**
 * @route   GET /api/smart-assistant/session/:session_key
 * @desc    Obtenir l'historique d'une session
 * @access  Private
 */
router.get('/session/:session_key', authMiddleware, getSessionHistory);

export default router;