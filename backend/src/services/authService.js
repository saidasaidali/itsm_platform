// src/services/authService.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_production';
const JWT_EXPIRES_IN = '8h';

// ─── Token ───────────────────────────────────────────────────────────────────

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ─── Password ────────────────────────────────────────────────────────────────

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function findUserByEmailOrUsername(identifier) {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.email, u.password, u.role_id, u.status, u.created_at,
            r.name AS role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.email = $1 OR u.username = $1
     LIMIT 1`,
    [identifier]
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.email, u.password, u.role_id, u.status, u.created_at,
            r.name AS role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function isUsernameTaken(username, excludeId = null) {
  const query = excludeId
    ? `SELECT id FROM users WHERE username = $1 AND id != $2`
    : `SELECT id FROM users WHERE username = $1`;
  const params = excludeId ? [username, excludeId] : [username];
  const { rows } = await pool.query(query, params);
  return rows.length > 0;
}

export async function isEmailTaken(email, excludeId = null) {
  const query = excludeId
    ? `SELECT id FROM users WHERE email = $1 AND id != $2`
    : `SELECT id FROM users WHERE email = $1`;
  const params = excludeId ? [email, excludeId] : [email];
  const { rows } = await pool.query(query, params);
  return rows.length > 0;
}

export async function isValidRole(roleId) {
  const { rows } = await pool.query(`SELECT id FROM roles WHERE id = $1`, [roleId]);
  return rows.length > 0;
}