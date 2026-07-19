// backend/src/services/settingsHistoryService.js
// Service pour l'historique des modifications de configuration
import pool from '../db.js';

// ─── Enregistrer une modification ────────────────────────────────────────────
export async function logSettingsChange(settingKey, oldValue, newValue, userId) {
  try {
    await pool.query(
      `INSERT INTO settings_history (setting_key, old_value, new_value, changed_by, changed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [settingKey, oldValue || null, newValue || null, userId]
    );
  } catch (err) {
    console.error('[SettingsHistory] Erreur lors de l\'enregistrement:', err.message);
    // Ne pas bloquer le processus principal si l'historique échoue
  }
}

// ─── Récupérer l'historique d'un paramètre ────────────────────────────────────
export async function getSettingsHistory(settingKey = null, limit = 50) {
  try {
    let query = `
      SELECT h.setting_key, h.old_value, h.new_value, h.changed_by, h.changed_at,
             u.username, u.email
      FROM settings_history h
      LEFT JOIN users u ON h.changed_by = u.id
    `;
    const params = [];
    
    if (settingKey) {
      query += ' WHERE h.setting_key = $1';
      params.push(settingKey);
    }
    
    query += ' ORDER BY h.changed_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const { rows } = await pool.query(query, params);
    return rows;
  } catch (err) {
    console.error('[SettingsHistory] Erreur lors de la récupération:', err.message);
    return [];
  }
}

// ─── Récupérer l'historique complet ──────────────────────────────────────────
export async function getAllSettingsHistory(limit = 100) {
  return getSettingsHistory(null, limit);
}

// ─── Créer la table si elle n'existe pas ─────────────────────────────────────
export async function createSettingsHistoryTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings_history (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        changed_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_settings_history_key ON settings_history(setting_key);
      CREATE INDEX IF NOT EXISTS idx_settings_history_changed_at ON settings_history(changed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_settings_history_changed_by ON settings_history(changed_by);
    `);
    console.log('[SettingsHistory] Table settings_history vérifiée/créée avec succès.');
  } catch (err) {
    console.error('[SettingsHistory] Erreur lors de la création de la table:', err.message);
  }
}

export default {
  logSettingsChange,
  getSettingsHistory,
  getAllSettingsHistory,
  createSettingsHistoryTable,
};