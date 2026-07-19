// backend/src/routes/sentimentRoutes.js
// Routes pour l'analyse de sentiment

import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  analyzeTextSentiment,
  analyzeTicketSentiment,
  analyzeCommentSentiment,
  getCriticalTickets
} from '../controllers/sentimentController.js';

const router = Router();

// Analyser un texte (pour test)
router.post('/analyze', authenticate, analyzeTextSentiment);

// Analyser le sentiment d'un ticket
router.post('/ticket/:ticketId', authenticate, analyzeTicketSentiment);

// Analyser le sentiment d'un commentaire
router.post('/comment/:commentId', authenticate, analyzeCommentSentiment);

// Récupérer les tickets critiques (Admin/Technicien uniquement)
router.get('/critical', authenticate, getCriticalTickets);

export default router;