// backend/src/routes/planningRoutes.js
import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getAllTechnicians,
  getTechnicianById,
  getMyPlanning,
  getConflicts
} from '../controllers/planningController.js';

const router = Router();
router.use(authenticate);

// Tous les utilisateurs authentifiés peuvent voir le planning
router.get('/technicians', authorize('Admin', 'Technicien'), getAllTechnicians);
router.get('/technicians/:id', authorize('Admin', 'Technicien'), getTechnicianById);
router.get('/me', getMyPlanning); // Voir son propre planning
router.get('/conflicts', authorize('Admin', 'Technicien'), getConflicts);

export default router;