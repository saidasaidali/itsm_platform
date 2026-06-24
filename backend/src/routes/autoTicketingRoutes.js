// backend/src/routes/autoTicketingRoutes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import { runAutoTicketingChecks, checkMLRiskScores } from '../services/autoTicketing/autoTicketEngine.js';

const router = Router();

router.post('/run-checks', authenticate, authorize('Admin'), async (req, res) => {
  const result = await runAutoTicketingChecks();
  res.json({ success: true, data: result });
});

// Nouveau : déclencher manuellement la prédiction ML + création de tickets préventifs
router.post('/run-ml', authenticate, authorize('Admin'), async (req, res) => {
  const created = await checkMLRiskScores();
  res.json({ success: true, data: { tickets_created: created } });
});

export default router;