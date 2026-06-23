// backend/src/controllers/userController.js
import { validationResult } from 'express-validator';
import pool from '../db.js';
import { t } from '../utils/i18n.js';
import { isUsernameTaken, isEmailTaken, isValidRole, findUserById, hashPassword } from '../services/authService.js';

// ─── GET /api/users (Admin) ───────────────────────────────────────────────────
export async function getUsers(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, u.role_id, u.status, u.created_at, r.name AS role_name
       FROM users u JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[getUsers]', err);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── GET /api/users/:id (Admin) ───────────────────────────────────────────────
export async function getUserById(req, res) {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, message: t(req, 'invalid_id') });
  try {
    const user = await findUserById(id);
    if (!user) return res.status(404).json({ success: false, message: t(req, 'user_not_found') });
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error('[getUserById]', err);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── POST /api/users (Admin) — compte créé directement actif ─────────────────
export async function createUser(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { username, email, password, role_id } = req.body;
  try {
    if (await isUsernameTaken(username)) return res.status(409).json({ success: false, message: t(req, 'username_taken') });
    if (await isEmailTaken(email))       return res.status(409).json({ success: false, message: t(req, 'email_taken') });
    if (!(await isValidRole(role_id)))   return res.status(400).json({ success: false, message: t(req, 'invalid_role') });

    const hashedPassword = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password, role_id, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, username, email, role_id, status, created_at`,
      [username, email, hashedPassword, role_id]
    );
    return res.status(201).json({ success: true, message: t(req, 'user_created'), data: rows[0] });
  } catch (err) {
    console.error('[createUser]', err);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── PUT /api/users/:id (Admin) ───────────────────────────────────────────────
export async function updateUser(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, message: t(req, 'invalid_id') });

  const { username, email, password, role_id } = req.body;
  try {
    const existing = await findUserById(id);
    if (!existing) return res.status(404).json({ success: false, message: t(req, 'user_not_found') });

    if (username && (await isUsernameTaken(username, id))) return res.status(409).json({ success: false, message: t(req, 'username_taken') });
    if (email    && (await isEmailTaken(email, id)))       return res.status(409).json({ success: false, message: t(req, 'email_taken') });
    if (role_id  && !(await isValidRole(role_id)))         return res.status(400).json({ success: false, message: t(req, 'invalid_role') });

    const newPassword = password ? await hashPassword(password) : existing.password;
    const { rows } = await pool.query(
      `UPDATE users
       SET username = COALESCE($1, username),
           email    = COALESCE($2, email),
           password = $3,
           role_id  = COALESCE($4, role_id)
       WHERE id = $5
       RETURNING id, username, email, role_id, status, created_at`,
      [username || null, email || null, newPassword, role_id || null, id]
    );
    return res.status(200).json({ success: true, message: t(req, 'user_updated'), data: rows[0] });
  } catch (err) {
    console.error('[updateUser]', err);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── PATCH /api/users/me — Profil personnel (tous rôles) ─────────────────────
export async function updateOwnProfile(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const userId = req.user.id;
  const { username, email, password } = req.body;

  try {
    const existing = await findUserById(userId);
    if (!existing) return res.status(404).json({ success: false, message: t(req, 'user_not_found') });

    if (username && (await isUsernameTaken(username, userId))) return res.status(409).json({ success: false, message: t(req, 'username_taken') });
    if (email    && (await isEmailTaken(email, userId)))       return res.status(409).json({ success: false, message: t(req, 'email_taken') });

    const newPassword = password ? await hashPassword(password) : existing.password;
    const { rows } = await pool.query(
      `UPDATE users
       SET username = COALESCE($1, username),
           email    = COALESCE($2, email),
           password = $3
       WHERE id = $4
       RETURNING id, username, email, role_id, status, created_at`,
      [username || null, email || null, newPassword, userId]
    );
    return res.status(200).json({ success: true, message: t(req, 'profile_updated'), data: rows[0] });
  } catch (err) {
    console.error('[updateOwnProfile]', err);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── PATCH /api/users/:id/status (Admin) ─────────────────────────────────────
export async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (isNaN(id)) return res.status(400).json({ success: false, message: t(req, 'invalid_id') });
  if (parseInt(id) === req.user.id) return res.status(400).json({ success: false, message: t(req, 'cannot_change_own_status') });

  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE users SET status = $1 WHERE id = $2
       RETURNING id, username, email, role_id, status, created_at`,
      [status, id]
    );
    if (rowCount === 0) return res.status(404).json({ success: false, message: t(req, 'user_not_found') });

    const labels = { active: 'activé', inactive: 'désactivé', pending: 'mis en attente' };
    return res.status(200).json({ success: true, message: `Compte ${labels[status]}.`, data: rows[0] });
  } catch (err) {
    console.error('[updateUserStatus]', err);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── DELETE /api/users/:id (Admin) ───────────────────────────────────────────
export async function deleteUser(req, res) {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, message: t(req, 'invalid_id') });
  if (parseInt(id) === req.user.id) return res.status(400).json({ success: false, message: t(req, 'cannot_delete_self') });

  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ success: false, message: t(req, 'user_not_found') });
    return res.status(200).json({ success: true, message: t(req, 'user_deleted') });
  } catch (err) {
    console.error('[deleteUser]', err);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── GET /api/users/technicians — techniciens actifs uniquement ───────────────
export async function getActiveTechnicians(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username AS name, u.email,
              r.name AS role,
              COUNT(t.id) AS active_tickets
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN tickets t ON t.assigned_to = u.id
         AND t.status NOT IN ('Résolu', 'Clôturé')
       WHERE r.name = 'Technicien'
         AND u.status = 'active'
       GROUP BY u.id, u.username, u.email, r.name
       ORDER BY u.username ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getActiveTechnicians]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}