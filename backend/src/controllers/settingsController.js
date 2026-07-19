import pool from '../db.js';
import { reloadSettings } from '../services/settingsService.js';
import { getSettings } from '../services/settingsService.js';
import { logSettingsChange } from '../services/settingsHistoryService.js';
import emailService from '../services/emailService.js';
import { t } from '../utils/i18n.js';
import asyncHandler from '../middlewares/asyncHandler.js';

const SENSITIVE_KEYS = ['smtp_pass'];

// ─── GET /api/settings/system — Admin uniquement ──────────────────────────────
export const getSystemSettings = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`SELECT setting_key, setting_value FROM system_settings`);
  const settings = {};
  rows.forEach((r) => {
    settings[r.setting_key] = SENSITIVE_KEYS.includes(r.setting_key)
      ? (r.setting_value ? '••••••••' : '')
      : r.setting_value;
  });
  return res.json({ success: true, settings });
});

// ─── PATCH /api/settings/system — Admin uniquement ────────────────────────────
export const updateSystemSettings = asyncHandler(async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, message: t(req, 'invalid_data') });
  }

  // Récupérer les anciennes valeurs pour l'historique
  const { rows: oldSettings } = await pool.query(
    `SELECT setting_key, setting_value FROM system_settings`
  );
  const oldValuesMap = {};
  oldSettings.forEach((r) => { oldValuesMap[r.setting_key] = r.setting_value; });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(updates)) {
      if (SENSITIVE_KEYS.includes(key) && value === '••••••••') continue;

      const oldValue = oldValuesMap[key];
      
      await client.query(
        `INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (setting_key)
         DO UPDATE SET setting_value = $2, updated_by = $3, updated_at = NOW()`,
        [key, String(value), req.user.id]
      );

      // Enregistrer dans l'historique (sans les mots de passe)
      if (!SENSITIVE_KEYS.includes(key)) {
        await logSettingsChange(key, oldValue, String(value), req.user.id);
      }
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

  // Log des modifications (sans mots de passe)
  const safeUpdates = { ...updates };
  if (safeUpdates.smtp_pass) safeUpdates.smtp_pass = '••••••••';
  
  console.log('[Settings] Paramètres système modifiés:', JSON.stringify(safeUpdates, null, 2));
  console.log('[Settings] Configuration rechargée avec succès');

  return res.json({ success: true, message: t(req, 'system_settings_updated') });
});

// ─── GET /api/settings/preferences — tous les rôles ───────────────────────────
export const getPreferences = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT language, date_format FROM users WHERE id = $1`,
    [req.user.id]
  );
  const prefs = rows[0] || {};
  // Si la langue n'est pas définie, ne pas retourner de valeur par défaut
  // pour éviter de forcer un changement de langue côté frontend
  return res.json({ success: true, preferences: prefs });
});

// ─── PATCH /api/settings/preferences — tous les rôles ─────────────────────────
export const updatePreferences = asyncHandler(async (req, res) => {
  const { language, date_format } = req.body;
  await pool.query(
    `UPDATE users SET
       language    = COALESCE($1, language),
       date_format = COALESCE($2, date_format)
     WHERE id = $3`,
    [language, date_format, req.user.id]
  );
  return res.json({ success: true, message: t(req, 'preferences_updated') });
});

// ─── GET /api/public/config — public, non sensible ───────────────────────────
export const getPublicConfig = asyncHandler(async (req, res) => {
  // Construire une config publique non sensible
  const s = getSettings();
  const apiUrl = `${req.protocol}://${req.get('host')}`;
  const publicConfig = {
    apiUrl,
    frontendUrl: s.frontend_url || '',
    corsOrigin: s.cors_origin || '',
    featureFlags: {
      enableAdScan: !!s.enable_ad_scan,
      enableSnmpScan: !!s.enable_snmp_scan,
    }
  };
  return res.json({ success: true, config: publicConfig });
});

// ─── POST /api/settings/test-smtp — Admin only
export const testSmtp = asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ success: false, message: 'Missing `to` address' });
  const s = getSettings();
  const subject = '[ITSM] Test SMTP — Vérification de configuration';
  const url = s.frontend_url || '';
  const html = `<p>Test SMTP envoyé depuis la plateforme ITSM.</p><p>URL front : ${url}</p>`;
  try {
    emailService.sendMailDirect(to, url, html, subject);
    return res.json({ success: true, message: 'Test email envoyé (non bloquant)' });
  } catch (err) {
    console.error('[testSmtp] Erreur envoi test SMTP:', err.message);
    return res.status(500).json({ success: false, message: 'Erreur envoi SMTP' });
  }
});