// backend/src/routes/userRoutes.js
import { Router } from 'express';
import { body } from 'express-validator';
import {
  getUsers, getUserById, createUser, updateUser,
  deleteUser, updateUserStatus, updateOwnProfile,
} from '../controllers/userController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import { adminResetPassword } from '../controllers/authController.js';


const router = Router();

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

// ─── Route profil — accessible à TOUS les utilisateurs connectés ──────────────
// IMPORTANT : doit être AVANT /:id pour ne pas être interceptée
router.patch('/me', authenticate, profileValidation, updateOwnProfile);

// ─── Routes Admin ─────────────────────────────────────────────────────────────
router.get('/', authenticate, authorize('Admin'), getUsers);
router.get('/:id', authenticate, authorize('Admin'), getUserById);
router.post('/', authenticate, authorize('Admin'), createValidation, createUser);
router.put('/:id', authenticate, authorize('Admin'), updateValidation, updateUser);
router.patch('/:id/status', authenticate, authorize('Admin'), statusValidation, updateUserStatus);
router.delete('/:id', authenticate, authorize('Admin'), deleteUser);
router.patch('/:id/reset-password', authenticate, authorize('Admin'), adminResetPassword);


export default router;