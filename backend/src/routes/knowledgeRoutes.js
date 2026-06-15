// src/routes/knowledgeRoutes.js
import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getArticles, getArticleById, createArticle,
  updateArticle, deleteArticle, searchForChatbot,
} from '../controllers/knowledgeController.js';

const router = Router();

const articleValidation = [
  body('title').notEmpty().withMessage('Titre obligatoire.').trim(),
  body('summary').notEmpty().withMessage('Résumé obligatoire.').trim(),
  body('content').notEmpty().withMessage('Contenu obligatoire.').trim(),
  body('category').optional().isIn([
    'Procédures', 'Solutions techniques', 'FAQ', 'Documentation matériel'
  ]).withMessage('Catégorie invalide.'),
];

// Recherche pour le chatbot (accessible à tous les authentifiés)
router.get('/search', authenticate, searchForChatbot);

// CRUD
router.get('/',    authenticate, getArticles);
router.get('/:id', authenticate, getArticleById);
router.post('/',   authenticate, authorize('Admin','Technicien'), articleValidation, createArticle);
router.put('/:id', authenticate, authorize('Admin','Technicien'), articleValidation, updateArticle);
router.delete('/:id', authenticate, authorize('Admin'), deleteArticle);

export default router;