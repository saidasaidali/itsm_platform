// backend/src/controllers/userController.js
import { validationResult } from 'express-validator';
import pool from '../db.js';
import { t } from '../utils/i18n.js';
import { isUsernameTaken, isEmailTaken, isValidRole, findUserById, hashPassword } from '../services/authService.js';
import * as emailService from '../services/emailService.js';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import asyncHandler from '../middlewares/asyncHandler.js';

// ─── GET /api/users (Admin) ───────────────────────────────────────────────────
export const getUsers = asyncHandler(async (req, res) => {
    const { service } = req.query;
    const params = [];
    let where = '';
    if (service) { params.push(service); where = ` WHERE u.service = $1`; }
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email, u.role_id, u.status, u.created_at, r.name AS role_name,
              u.direction, u.division, u.service
       FROM users u JOIN roles r ON u.role_id = r.id${where}
       ORDER BY u.created_at DESC`,
      params
    );
    return res.status(200).json({ success: true, data: rows });
});

// ─── GET /api/users/:id (Admin) ───────────────────────────────────────────────
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, message: t(req, 'invalid_id') });
  const user = await findUserById(parseInt(id));
  if (!user) return res.status(404).json({ success: false, message: t(req, 'user_not_found') });
  return res.status(200).json({ success: true, data: user });
});

// ─── POST /api/users (Admin) — compte créé directement actif ─────────────────
export const createUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { username, email, password, role_id, direction, division, service } = req.body;
  if (await isUsernameTaken(username)) return res.status(409).json({ success: false, message: t(req, 'username_taken') });
    if (await isEmailTaken(email))       return res.status(409).json({ success: false, message: t(req, 'email_taken') });
    if (!(await isValidRole(role_id)))   return res.status(400).json({ success: false, message: t(req, 'invalid_role') });

    const hashedPassword = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password, role_id, status, direction, division, service)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7)
       RETURNING id, username, email, role_id, status, created_at, direction, division, service`,
      [username, email, hashedPassword, role_id, direction || null, division || null, service || null]
    );
    return res.status(201).json({ success: true, message: t(req, 'user_created'), data: rows[0] });
});

// ─── PUT /api/users/:id (Admin) ───────────────────────────────────────────────
export const updateUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, message: t(req, 'invalid_id') });

  const { username, email, password, role_id, direction, division, service } = req.body;
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
           role_id  = COALESCE($4, role_id),
           direction = COALESCE($5, direction),
           division  = COALESCE($6, division),
           service   = COALESCE($7, service)
       WHERE id = $8
       RETURNING id, username, email, role_id, status, created_at, direction, division, service`,
      [username || null, email || null, newPassword, role_id || null, direction || null, division || null, service || null, id]
    );
    return res.status(200).json({ success: true, message: t(req, 'user_updated'), data: rows[0] });
});

// ─── PATCH /api/users/me — Profil personnel (tous rôles) ─────────────────────
export const updateOwnProfile = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const userId = req.user.id;
  const { username, email, password } = req.body;

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
       RETURNING id, username, email, role_id, status, created_at, direction, division, service`,
      [username || null, email || null, newPassword, userId]
    );
    return res.status(200).json({ success: true, message: t(req, 'profile_updated'), data: rows[0] });
});

// ─── PATCH /api/users/:id/status (Admin) ─────────────────────────────────────
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (isNaN(id)) return res.status(400).json({ success: false, message: t(req, 'invalid_id') });
  if (parseInt(id) === req.user.id) return res.status(400).json({ success: false, message: t(req, 'cannot_change_own_status') });

  const { rows, rowCount } = await pool.query(
      `UPDATE users SET status = $1 WHERE id = $2
       RETURNING id, username, email, role_id, status, created_at`,
      [status, id]
    );
    if (rowCount === 0) return res.status(404).json({ success: false, message: t(req, 'user_not_found') });

    const labels = { active: 'activé', inactive: 'désactivé', pending: 'mis en attente' };
    return res.status(200).json({ success: true, message: `Compte ${labels[status]}.`, data: rows[0] });
});

// ─── DELETE /api/users/:id (Admin) ───────────────────────────────────────────
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, message: t(req, 'invalid_id') });
  if (parseInt(id) === req.user.id) return res.status(400).json({ success: false, message: t(req, 'cannot_delete_self') });

  console.log(`[deleteUser] Tentative de suppression de l'utilisateur ID: ${id}`);
    
    // Vérifier d'abord si l'utilisateur existe
    const { rows: existing } = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [id]);
    if (existing.length === 0) {
      console.log(`[deleteUser] Utilisateur ID ${id} non trouvé`);
      return res.status(404).json({ success: false, message: t(req, 'user_not_found') });
    }
    
    console.log(`[deleteUser] Utilisateur trouvé:`, existing[0]);
    
    // Vérifier les contraintes de clé étrangère avant suppression
    const { rows: constraints } = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'users'
        AND kcu.table_name != 'users'
    `);
    
    console.log(`[deleteUser] Contraintes de clé étrangère trouvées:`, constraints);
    
    // Supprimer d'abord les données liées dans les tables de dépendance
    for (const constraint of constraints) {
      const { table_name, column_name } = constraint;
      console.log(`[deleteUser] Suppression dans ${table_name}.${column_name} pour user_id=${id}`);
      await pool.query(`DELETE FROM ${table_name} WHERE ${column_name} = $1`, [id]);
    }
    
    // Maintenant supprimer l'utilisateur
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    console.log(`[deleteUser] Lignes supprimées: ${rowCount}`);
    
    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: t(req, 'user_not_found') });
    }
    
    console.log(`[deleteUser] Utilisateur ${id} supprimé avec succès`);
    return res.status(200).json({ success: true, message: t(req, 'user_deleted') });
});

// ─── GET /api/users/technicians — techniciens actifs uniquement ───────────────
export const getActiveTechnicians = asyncHandler(async (req, res) => {
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
});



// ─── POST /api/users/import — Import Excel (Admin) ────────────────────────────
export const importUsersFromExcel = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Fichier Excel manquant.' });
  }

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
      const directionCol = findCol('direction');
      const divisionCol  = findCol('division');
      const serviceCol   = findCol('service');

      const nom    = row[nomCol]?.toString().trim();
      const prenom = row[prenomCol]?.toString().trim();
      const email  = row[emailCol]?.toString().trim().toLowerCase();
      const roleTxt = normalize(row[roleCol]?.toString());
      const direction = row[directionCol]?.toString().trim() || null;
      const division  = row[divisionCol]?.toString().trim() || null;
      const service   = row[serviceCol]?.toString().trim() || null;

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
        `INSERT INTO users (username, email, password, role_id, status, direction, division, service)
         VALUES ($1, $2, $3, $4, 'active', $5, $6, $7)
         RETURNING id, username, email`,
        [finalUsername, email, hashed, roleId, direction, division, service]
      );

      // Envoyer l'email avec les identifiants
      console.log('[ImportUsers] Envoi email de bienvenue:', {
        destinataire: email,
        nom: `${prenom} ${nom}`,
        username: finalUsername,
      });
      await emailService.sendWelcomeEmail(
        email,
        `${prenom} ${nom}`,
        finalUsername,
        tempPassword
      );
      console.log('[ImportUsers] Email de bienvenue envoyé pour:', email);

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
});

// ─── GET /api/users/services — Liste des services distincts ──────────────────
export const getServicesList = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT service FROM users WHERE service IS NOT NULL AND service != '' ORDER BY service ASC`
  );
  return res.json({ success: true, data: rows.map(r => r.service) });
});

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