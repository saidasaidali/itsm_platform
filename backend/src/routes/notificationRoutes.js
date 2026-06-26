// src/routes/notificationRoutes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getNotifications, getUnreadCount, markRead, markAllRead,
  deleteNotification, getPreferences, updatePreferences,
  createNotification,
} from '../controllers/notificationController.js';

const router = Router();

// Préférences — avant /:id pour éviter conflit
router.get('/preferences',  authenticate, getPreferences);
router.put('/preferences',  authenticate, updatePreferences);

// Compteur non-lus
router.get('/unread-count', authenticate, getUnreadCount);

// Marquer tout lu — avant /:id
router.put('/read-all', authenticate, markAllRead);

// CRUD notifications
router.get('/', authenticate, getNotifications);

// Créer (Admin) — AVANT les routes /:id pour éviter les conflits
router.post('/', authenticate, authorize('Admin'), createNotification);

router.put('/:id/read', authenticate, markRead);
router.delete('/:id',   authenticate, deleteNotification);

export default router;
