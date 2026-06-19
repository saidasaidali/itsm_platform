// backend/src/routes/anomalyRoutes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getAnomalies, getUnknownDevices, resolveAnomaly, getAnomalyStats,
} from '../controllers/anomalyController.js';

const router = Router();

router.get('/stats',           authenticate, authorize('Admin','Technicien'), getAnomalyStats);
router.get('/unknown-devices', authenticate, authorize('Admin','Technicien'), getUnknownDevices);
router.get('/',                authenticate, authorize('Admin','Technicien'), getAnomalies);
router.patch('/:id/resolve',   authenticate, authorize('Admin','Technicien'), resolveAnomaly);

export default router;