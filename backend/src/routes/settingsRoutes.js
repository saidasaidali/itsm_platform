import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getSystemSettings, updateSystemSettings,
  getPreferences, updatePreferences,
  getPublicConfig, testSmtp,
} from '../controllers/settingsController.js';

const router = express.Router();

router.get('/system',        authenticate, authorize('Admin'), getSystemSettings);
router.patch('/system',      authenticate, authorize('Admin'), updateSystemSettings);

// Public config (no auth)
router.get('/public', getPublicConfig);
router.post('/test-smtp', authenticate, authorize('Admin'), testSmtp);

router.get('/preferences',   authenticate, getPreferences);
router.patch('/preferences', authenticate, updatePreferences);

export default router;