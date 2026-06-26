// src/routes/authRoutes.js
import { Router } from 'express';
import { body } from 'express-validator';
import { login, register, me, logout } from '../controllers/authController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/roleMiddleware.js';
import {
  forgotPassword, checkResetToken, resetPassword,
} from '../controllers/authController.js';
import { getAssetMLPrediction } from '../controllers/assetController.js';



const router = Router();

// ─── Validations ─────────────────────────────────────────────────────────────

const loginValidation = [
  body('identifier')
    .notEmpty().withMessage('Email ou nom d\'utilisateur obligatoire.'),
  body('password')
    .notEmpty().withMessage('Mot de passe obligatoire.'),
];

const registerValidation = [
  body('username')
    .notEmpty().withMessage('Nom d\'utilisateur obligatoire.')
    .isLength({ min: 3 }).withMessage('Nom d\'utilisateur : minimum 3 caractères.')
    .trim(),
  body('email')
    .notEmpty().withMessage('Email obligatoire.')
    .isEmail().withMessage('Format email invalide.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Mot de passe obligatoire.')
    .isLength({ min: 8 }).withMessage('Mot de passe : minimum 8 caractères.')
    .matches(/[A-Z]/).withMessage('Mot de passe : au moins une majuscule.')
    .matches(/[a-z]/).withMessage('Mot de passe : au moins une minuscule.')
    .matches(/[0-9]/).withMessage('Mot de passe : au moins un chiffre.')
    .matches(/[^A-Za-z0-9]/).withMessage('Mot de passe : au moins un caractère spécial.'),
  body('role_id')
    .notEmpty().withMessage('Rôle obligatoire.')
    .isInt({ min: 1 }).withMessage('Rôle invalide.'),
];

// ─── Routes ──────────────────────────────────────────────────────────────────

router.post('/login', loginValidation, login);

router.post('/register', registerValidation, register);

router.get('/me', authenticate, me);

router.post('/logout', authenticate, logout);

// Validations pour les routes de réinitialisation de mot de passe
const forgotPasswordValidation = [
  body('email')
    .notEmpty().withMessage('Email obligatoire.')
    .isEmail().withMessage('Format email invalide.')
    .normalizeEmail(),
];

const resetPasswordValidation = [
  body('password')
    .notEmpty().withMessage('Mot de passe obligatoire.')
    .isLength({ min: 8 }).withMessage('Mot de passe : minimum 8 caractères.')
    .matches(/[A-Z]/).withMessage('Mot de passe : au moins une majuscule.')
    .matches(/[a-z]/).withMessage('Mot de passe : au moins une minuscule.')
    .matches(/[0-9]/).withMessage('Mot de passe : au moins un chiffre.')
    .matches(/[^A-Za-z0-9]/).withMessage('Mot de passe : au moins un caractère spécial.'),
];

router.post('/forgot-password',          forgotPasswordValidation, forgotPassword);
router.get('/reset-password/:token',     checkResetToken);
router.post('/reset-password/:token',    resetPasswordValidation, resetPassword);

export default router;
