import express from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { getTicketSuggestions } from '../controllers/suggestionController.js';

const router = express.Router();

router.post('/tickets', authenticate, getTicketSuggestions);

export default router;
