// backend/src/routes/dashboardRoutes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import { getRealtimeDashboard, getNetworkMap } from '../controllers/dashboardController.js';

const router = Router();

router.get('/realtime',    authenticate, authorize('Admin','Technicien'), getRealtimeDashboard);
router.get('/network-map', authenticate, authorize('Admin','Technicien'), getNetworkMap);

export default router;