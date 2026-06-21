import pool from '../db.js';
import { reloadSettings } from '../services/settingsService.js';

const SENSITIVE_KEYS = ['smtp_pass'];

// ─── GET /api/settings/system — Admin uniquement ──────────────────────────────
export async function getSystemSettings(req, res) {
  try {
    const { rows } = await pool.query(`SELECT setting_key, setting_value FROM system_settings`);
    const settings = {};
    rows.forEach((r) => {
      settings[r.setting_key] = SENSITIVE_KEYS.includes(r.setting_key)
        ? (r.setting_value ? '••••••••' : '')
        : r.setting_value;
    });
    return res.json({ success: true, settings });
  } catch (err) {
    console.error('[getSystemSettings]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── PATCH /api/settings/system — Admin uniquement ────────────────────────────
export async function updateSystemSettings(req, res) {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, message: 'Données invalides.' });
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(updates)) {
        if (SENSITIVE_KEYS.includes(key) && value === '••••••••') continue;

        await client.query(
          `INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (setting_key)
           DO UPDATE SET setting_value = $2, updated_by = $3, updated_at = NOW()`,
          [key, String(value), req.user.id]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Recharge immédiatement le cache en mémoire pour que les changements
    // s'appliquent sans redémarrer le serveur
    await reloadSettings();

    return res.json({ success: true, message: 'Paramètres système mis à jour.' });
  } catch (err) {
    console.error('[updateSystemSettings]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── GET /api/settings/preferences — tous les rôles ───────────────────────────
export async function getPreferences(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT language, date_format FROM users WHERE id = $1`,
      [req.user.id]
    );
    return res.json({ success: true, preferences: rows[0] || {} });
  } catch (err) {
    console.error('[getPreferences]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── PATCH /api/settings/preferences — tous les rôles ─────────────────────────
export async function updatePreferences(req, res) {
  const { language, date_format } = req.body;
  try {
    await pool.query(
      `UPDATE users SET
         language    = COALESCE($1, language),
         date_format = COALESCE($2, date_format)
       WHERE id = $3`,
      [language, date_format, req.user.id]
    );
    return res.json({ success: true, message: 'Préférences mises à jour.' });
  } catch (err) {
    console.error('[updatePreferences]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}