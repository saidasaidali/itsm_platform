// backend/src/controllers/userController.js
import { validationResult } from 'express-validator';
import pool from '../db.js';
import { t } from '../utils/i18n.js';
import { isUsernameTaken, isEmailTaken, isValidRole, findUserById, hashPassword } from '../services/authService.js';
import crypto from 'crypto';
import * as XLSX from 'xlsx';

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



// ─── POST /api/users/import — Import Excel (Admin) ────────────────────────────
export async function importUsersFromExcel(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Fichier Excel manquant.' });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Le fichier est vide.' });
    }

    // Normalisation des noms de colonnes (insensible à la casse et aux espaces)
    const normalize = (str) => str?.toString().toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const ROLE_MAP = {
      'admin':      1,
      'technicien': 2,
      'agent':      3,
    };

    const results = {
      created:  [],
      skipped:  [],
      errors:   [],
    };

    for (const [i, row] of rows.entries()) {
      // Trouver les colonnes en ignorant la casse
      const keys     = Object.keys(row);
      const findCol  = (...names) => keys.find((k) => names.includes(normalize(k)));

      const nomCol    = findCol('nom', 'name', 'last_name', 'lastname');
      const prenomCol = findCol('prenom', 'prénom', 'first_name', 'firstname');
      const emailCol  = findCol('email', 'e-mail', 'mail', 'courriel');
      const roleCol   = findCol('role', 'rôle', 'profil', 'type');

      const nom    = row[nomCol]?.toString().trim();
      const prenom = row[prenomCol]?.toString().trim();
      const email  = row[emailCol]?.toString().trim().toLowerCase();
      const roleTxt = normalize(row[roleCol]?.toString());

      // Validation basique
      if (!email || !nom) {
        results.errors.push({
          ligne: i + 2,
          email: email || '—',
          raison: 'Nom ou email manquant.',
        });
        continue;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.errors.push({ ligne: i + 2, email, raison: 'Format email invalide.' });
        continue;
      }

      const roleId = ROLE_MAP[roleTxt] || 3; // Agent par défaut si rôle inconnu

      // Vérifier si l'email existe déjà
      const { rows: existing } = await pool.query(
        'SELECT id FROM users WHERE email = $1', [email]
      );
      if (existing[0]) {
        results.skipped.push({ ligne: i + 2, email, raison: 'Email déjà utilisé.' });
        continue;
      }

      // Générer un mot de passe aléatoire respectant les règles de validation
      const tempPassword = generateSecurePassword();
      const hashed       = await hashPassword(tempPassword);
      const username     = buildUsername(prenom, nom);

      // Vérifier unicité du username
      const finalUsername = await ensureUniqueUsername(username);

      // Créer l'utilisateur avec status 'active' (import admin = compte validé)
      const { rows: created } = await pool.query(
        `INSERT INTO users (username, email, password, role_id, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING id, username, email`,
        [finalUsername, email, hashed, roleId]
      );

      // Envoyer l'email avec les identifiants
      await emailService.sendWelcomeEmail(
        email,
        `${prenom} ${nom}`,
        finalUsername,
        tempPassword
      );

      results.created.push({
        ligne:    i + 2,
        username: finalUsername,
        email,
        role:     Object.keys(ROLE_MAP).find((k) => ROLE_MAP[k] === roleId) || 'agent',
      });
    }

    return res.json({
      success: true,
      message: `Import terminé : ${results.created.length} créé(s), ${results.skipped.length} ignoré(s), ${results.errors.length} erreur(s).`,
      results,
    });
  } catch (err) {
    console.error('[importUsersFromExcel]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur lors du traitement du fichier.' });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateSecurePassword() {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#$%&*!';
  const all     = upper + lower + digits + special;

  // Garantir au moins un de chaque type requis
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  // Compléter jusqu'à 10 caractères
  for (let i = pwd.length; i < 10; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Mélanger
  return pwd.sort(() => Math.random() - 0.5).join('');
}

function buildUsername(prenom, nom) {
  const clean = (s) => s?.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '') || '';
  return `${clean(prenom)}.${clean(nom)}`.slice(0, 30);
}

async function ensureUniqueUsername(base) {
  let username = base;
  let counter  = 1;
  while (true) {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE username = $1', [username]
    );
    if (!rows[0]) return username;
    username = `${base}${counter++}`;
  }
}