// backend/src/routes/autoTicketingRoutes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import { runAutoTicketingChecks } from '../services/autoTicketing/autoTicketEngine.js';

const router = Router();

router.post('/run-checks', authenticate, authorize('Admin'), async (req, res) => {
  const result = await runAutoTicketingChecks();
  res.json({ success: true, data: result });
});

export default router;