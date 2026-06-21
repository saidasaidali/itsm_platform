// src/controllers/authController.js
import { validationResult } from 'express-validator';
import crypto from 'crypto';
import {
  findUserByEmailOrUsername,
  findUserById,
  comparePassword,
  hashPassword,
  generateToken,
  isUsernameTaken,
  isEmailTaken,
  isValidRole,
} from '../services/authService.js';
import pool from '../db.js';
import emailService from '../services/emailService.js';

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3001';

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
export async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { identifier, password } = req.body;

  try {
    const user = await findUserByEmailOrUsername(identifier);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects.' });
    }

    const passwordMatch = await comparePassword(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects.' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Votre compte est en attente de validation par un administrateur.',
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Votre compte a été désactivé. Contactez un administrateur.',
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role_name,
        status: user.status,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── POST /api/auth/register (Public) ────────────────────────────────────────
export async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, email, password, role_id } = req.body;

  try {
    const publicRoles = [2, 3]; // Technicien, Agent
    if (!publicRoles.includes(Number(role_id))) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide. Seuls les rôles Agent et Technicien sont disponibles à l\'inscription.',
      });
    }

    if (await isUsernameTaken(username)) {
      return res.status(409).json({ success: false, message: 'Ce nom d\'utilisateur est déjà utilisé.' });
    }

    if (await isEmailTaken(email)) {
      return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé.' });
    }

    if (!(await isValidRole(role_id))) {
      return res.status(400).json({ success: false, message: 'Rôle invalide.' });
    }

    const hashedPassword = await hashPassword(password);

    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password, role_id, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, username, email, role_id, status, created_at`,
      [username, email, hashedPassword, role_id]
    );

    return res.status(201).json({
      success: true,
      message: 'Compte créé avec succès. Votre demande est en attente de validation par un administrateur.',
      user: rows[0],
    });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
export async function me(req, res) {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    }
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role_name,
        status: user.status,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('[me]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
export function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Déconnexion effectuée.',
  });
}

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
export async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email requis.' });
  }

  try {
    // Utilise 'status' (cohérent avec login/register), pas 'is_active'
    const { rows } = await pool.query(
      `SELECT id, username, email FROM users WHERE email = $1 AND status = 'active'`,
      [email]
    );

    if (!rows[0]) {
      return res.json({
        success: true,
        message: 'Si ce compte existe, un email de réinitialisation a été envoyé.',
      });
    }

    const user = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await pool.query(
      `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
      [token, expires, user.id]
    );

    const resetUrl = `${FRONTEND}/#/reset-password/${token}`;

    await emailService.sendPasswordResetEmail(user.email, user.username, resetUrl);

    return res.json({
      success: true,
      message: 'Si ce compte existe, un email de réinitialisation a été envoyé.',
    });
  } catch (err) {
    console.error('[forgotPassword]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── GET /api/auth/reset-password/:token — vérifier validité ─────────────────
export async function checkResetToken(req, res) {
  const { token } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );
    if (!rows[0]) {
      return res.status(400).json({ success: false, message: 'Lien invalide ou expiré.' });
    }
    return res.json({ success: true, message: 'Lien valide.' });
  } catch (err) {
    console.error('[checkResetToken]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── POST /api/auth/reset-password/:token ─────────────────────────────────────
export async function resetPassword(req, res) {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Le mot de passe doit contenir au moins 6 caractères.',
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, username, email FROM users
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );
    if (!rows[0]) {
      return res.status(400).json({ success: false, message: 'Lien invalide ou expiré.' });
    }

    const user = rows[0];
    // Utilise hashPassword (le même service que register), colonne 'password'
    const hashed = await hashPassword(password);

    await pool.query(
      `UPDATE users SET
         password = $1,
         reset_token = NULL,
         reset_token_expires = NULL
       WHERE id = $2`,
      [hashed, user.id]
    );

    return res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
  } catch (err) {
    console.error('[resetPassword]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── PATCH /api/users/:id/reset-password — Admin force un reset ──────────────
export async function adminResetPassword(req, res) {
  const { id } = req.params;
  if (isNaN(id)) {
    return res.status(400).json({ success: false, message: 'ID invalide.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, username, email FROM users WHERE id = $1`, [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    }
    const user = rows[0];

    const tempPassword = crypto.randomBytes(6).toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
    const hashed = await hashPassword(tempPassword);

    await pool.query(
      `UPDATE users SET
         password = $1,
         reset_token = NULL,
         reset_token_expires = NULL
       WHERE id = $2`,
      [hashed, id]
    );

    await emailService.sendTempPasswordEmail(user.email, user.username, tempPassword);

    return res.json({
      success: true,
      message: `Mot de passe réinitialisé. Un email a été envoyé à ${user.email}.`,
      tempPassword,
    });
  } catch (err) {
    console.error('[adminResetPassword]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}