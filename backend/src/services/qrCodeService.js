// backend/src/services/qrCodeService.js
import crypto from 'crypto';
import pool from '../db.js';

/**
 * Génère un token unique pour un équipement
 */
export function generateQrToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Assigne un qr_token à un équipement
 */
export async function assignQrToken(assetId) {
  const token = generateQrToken();
  await pool.query('UPDATE assets SET qr_token = $1 WHERE id = $2', [token, assetId]);
  return token;
}

/**
 * Récupère un équipement par son qr_token
 */
export async function getAssetByQrToken(token) {
  const { rows } = await pool.query(
    `SELECT a.*, u.username AS assigned_to_name
     FROM assets a
     LEFT JOIN users u ON a.assigned_to = u.id
     WHERE a.qr_token = $1`,
    [token]
  );
  return rows[0] || null;
}

/**
 * Enregistre un scan dans l'historique
 */
export async function logScan(assetId, userId, ipAddress, userAgent) {
  await pool.query(
    `INSERT INTO scan_history (asset_id, user_id, ip_address, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [assetId, userId || null, ipAddress || null, userAgent || null]
  );
}

/**
 * Récupère l'historique des scans d'un équipement
 */
export async function getScanHistory(assetId) {
  const { rows } = await pool.query(
    `SELECT sh.*, u.username AS scanned_by_name
     FROM scan_history sh
     LEFT JOIN users u ON sh.user_id = u.id
     WHERE sh.asset_id = $1
     ORDER BY sh.scanned_at DESC
     LIMIT 50`,
    [assetId]
  );
  return rows;
}