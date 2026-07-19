// src/routes/knowledgeRoutes.js
import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  getArticles, getArticleById, createArticle,
  updateArticle, deleteArticle, searchForChatbot,
  importArticlesFromExcel,
} from '../controllers/knowledgeController.js';

const router = Router();

// ─── Multer — configuration pour l'upload de documents ───────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'text/plain',
    ];
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExt = ['xlsx', 'xls', 'docx', 'pdf', 'txt'];
    
    if (allowed.includes(file.mimetype) || allowedExt.includes(ext || '')) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez .xlsx, .docx, .pdf ou .txt.'));
    }
  },
});

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

// Import Excel (Admin/Technicien)
router.post('/import', authenticate, authorize('Admin','Technicien'), upload.single('file'), importArticlesFromExcel);

export default router;