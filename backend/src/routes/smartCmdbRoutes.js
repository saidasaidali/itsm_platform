// backend/src/routes/smartCmdbRoutes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getAssetTwin, getUserMap, refreshLiveStates, detectRelations, getLiveDashboard,
} from '../controllers/smartCmdbController.js';

const router = Router();

router.get('/dashboard',           authenticate, authorize('Admin','Technicien'), getLiveDashboard);
router.get('/asset/:id/twin',      authenticate, authorize('Admin','Technicien'), getAssetTwin);
router.get('/user/:userId/map',    authenticate, authorize('Admin','Technicien'), getUserMap);
router.post('/refresh-live',       authenticate, authorize('Admin'), refreshLiveStates);
router.post('/detect-relations',   authenticate, authorize('Admin'), detectRelations);

export default router;