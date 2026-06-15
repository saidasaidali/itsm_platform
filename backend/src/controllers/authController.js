// src/controllers/authController.js
import { validationResult } from 'express-validator';
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

    // ─── Vérification du statut du compte ────────────────────────────────────
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
    // ─────────────────────────────────────────────────────────────────────────

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
// Les agents et techniciens s'inscrivent ici avec status 'pending'.
// L'admin doit valider le compte avant que l'utilisateur puisse se connecter.
export async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, email, password, role_id } = req.body;

  try {
    // Seuls les rôles Agent (3) et Technicien (2) peuvent s'inscrire publiquement
    // L'Admin (1) ne peut être créé que par un admin existant via /api/users
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

    // Le compte est créé avec status 'pending' — doit être validé par un admin
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