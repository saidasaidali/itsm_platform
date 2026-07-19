// backend/src/routes/userRoutes.js
import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import {
  getUsers, getUserById, createUser, updateUser,
  deleteUser, updateUserStatus, updateOwnProfile,
  getActiveTechnicians, importUsersFromExcel,
  getServicesList,
} from '../controllers/userController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import { adminResetPassword } from '../controllers/authController.js';

const router = Router();

// ─── Multer — une seule déclaration avec toutes les options ───────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format invalide. Utilisez un fichier .xlsx ou .xls.'));
    }
  },
});

// ─── Validations ──────────────────────────────────────────────────────────────
const createValidation = [
  body('username').notEmpty().withMessage('Nom d\'utilisateur obligatoire.').isLength({ min: 3 }).trim(),
  body('email').notEmpty().isEmail().withMessage('Format email invalide.').normalizeEmail(),
  body('password')
    .notEmpty().isLength({ min: 8 })
    .matches(/[A-Z]/).withMessage('Au moins une majuscule.')
    .matches(/[a-z]/).withMessage('Au moins une minuscule.')
    .matches(/[0-9]/).withMessage('Au moins un chiffre.')
    .matches(/[^A-Za-z0-9]/).withMessage('Au moins un caractère spécial.'),
  body('role_id').notEmpty().isInt({ min: 1 }).withMessage('Rôle invalide.'),
];

const updateValidation = [
  body('username').optional().isLength({ min: 3 }).trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('password')
    .optional()
    .isLength({ min: 8 })
    .matches(/[A-Z]/).withMessage('Au moins une majuscule.')
    .matches(/[a-z]/).withMessage('Au moins une minuscule.')
    .matches(/[0-9]/).withMessage('Au moins un chiffre.')
    .matches(/[^A-Za-z0-9]/).withMessage('Au moins un caractère spécial.'),
];

const profileValidation = [
  body('username').optional().isLength({ min: 3 }).trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 8 }).withMessage('Minimum 8 caractères.')
    .matches(/[A-Z]/).withMessage('Au moins une majuscule.')
    .matches(/[a-z]/).withMessage('Au moins une minuscule.')
    .matches(/[0-9]/).withMessage('Au moins un chiffre.')
    .matches(/[^A-Za-z0-9]/).withMessage('Au moins un caractère spécial.'),
];

const statusValidation = [
  body('status').notEmpty().isIn(['active', 'inactive', 'pending']).withMessage('Statut invalide.'),
];

// ─── Routes statiques — TOUTES avant les routes /:id ─────────────────────────

// Liste des services — avant /:id
router.get('/services', authenticate, getServicesList);

// Profil — accessible à tous les rôles connectés
router.patch('/me', authenticate, profileValidation, updateOwnProfile);

// Techniciens actifs — avant /:id
router.get('/technicians', authenticate, authorize('Admin', 'Technicien'), getActiveTechnicians);

// Import Excel — avant /:id
router.post('/import', authenticate, authorize('Admin'), upload.single('file'), importUsersFromExcel);

// ─── Routes Admin générales ───────────────────────────────────────────────────
router.get('/',  authenticate, authorize('Admin'), getUsers);
router.post('/', authenticate, authorize('Admin'), createValidation, createUser);

// ─── Routes Admin avec paramètre :id — APRÈS toutes les routes statiques ──────
router.get('/:id',                  authenticate, authorize('Admin'), getUserById);
router.put('/:id',                  authenticate, authorize('Admin'), updateValidation, updateUser);
router.patch('/:id/status',         authenticate, authorize('Admin'), statusValidation, updateUserStatus);
router.delete('/:id',               authenticate, authorize('Admin'), deleteUser);
router.patch('/:id/reset-password', authenticate, authorize('Admin'), adminResetPassword);

export default router;