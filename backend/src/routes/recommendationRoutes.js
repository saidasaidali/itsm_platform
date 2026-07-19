// backend/src/routes/recommendationRoutes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize as authorizeRole } from '../middlewares/roleMiddleware.js';
import {
  getTechnicianRecommendation,
  getTechnicianDetails,
} from '../controllers/recommendationController.js';

const router = Router();

// Tous les utilisateurs authentifiés peuvent voir les recommandations
router.get('/technician', authenticate, getTechnicianRecommendation);

// Détails d'un technicien (Admin/Technicien uniquement)
router.get('/technician/:id/stats', authenticate, authorizeRole('Admin', 'Technicien'), getTechnicianDetails);

export default router;