import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getTickets, getTicketById, createTicket,
  updateStatus, assignTicket, transferTicket,
  addComment, deleteTicket, getTicketStats,
  getTicketsByAsset, getReliabilityAlerts,   // ← nouveaux
} from '../controllers/ticketController.js';

const router = Router();

const ticketValidation = [
  body('title').notEmpty().withMessage('Titre obligatoire.').trim(),
  body('description').notEmpty().withMessage('Description obligatoire.').trim(),
  body('priority').optional().isIn(['Haute', 'Moyenne', 'Basse']).withMessage('Priorité invalide.'),
  body('asset_id').optional().isInt().withMessage('ID équipement invalide.'), // ← nouveau
];

// Stats — avant /:id
router.get('/stats',       authenticate, getTicketStats);
router.get('/reliability', authenticate, authorize('Admin','Technicien'), getReliabilityAlerts);

// Tickets d'un équipement
router.get('/asset/:assetId', authenticate, authorize('Admin','Technicien'), getTicketsByAsset);

// CRUD
router.get('/',    authenticate, getTickets);
router.get('/:id', authenticate, getTicketById);
router.post('/',   authenticate, authorize('Agent'), ticketValidation, createTicket);

// Transitions
router.patch('/:id/status',   authenticate, authorize('Admin','Technicien'), updateStatus);
router.patch('/:id/assign',   authenticate, authorize('Admin'), assignTicket);
router.patch('/:id/transfer', authenticate, authorize('Technicien'), transferTicket);

// Commentaires
router.post('/:id/comments', authenticate, addComment);

// Suppression
router.delete('/:id', authenticate, authorize('Admin'), deleteTicket);

export default router;