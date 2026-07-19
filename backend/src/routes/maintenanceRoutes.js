// backend/src/routes/maintenanceRoutes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getConfigs,
  getUpcoming,
  configure,
  remove,
  runScheduler,
  autoConfigure,
} from '../controllers/maintenanceController.js';

const router = Router();
router.use(authenticate);

router.get('/configs', authorize('Admin', 'Technicien'), getConfigs);
router.get('/upcoming', getUpcoming);
router.post('/configure/:assetId', authorize('Admin', 'Technicien'), configure);
router.delete('/configure/:assetId', authorize('Admin'), remove);
router.post('/run-scheduler', authorize('Admin'), runScheduler);
router.post('/auto-configure', authorize('Admin'), autoConfigure);

export default router;