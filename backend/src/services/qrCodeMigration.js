// backend/src/services/qrCodeMigration.js
import pool from '../db.js';

export async function runQRCodeMigration() {
  console.log('[QRCode] Vérification des colonnes QR Code...');
  try {
    // Ajouter la colonne qr_token à la table assets
    await pool.query(`
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS qr_token VARCHAR(64) UNIQUE DEFAULT NULL;
    `);

    // Créer la table scan_history si elle n'existe pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scan_history (
        id SERIAL PRIMARY KEY,
        asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Index pour les recherches rapides
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_scan_history_asset_id ON scan_history(asset_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_at ON scan_history(scanned_at);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_assets_qr_token ON assets(qr_token);
    `);

    console.log('[QRCode] Migration terminée avec succès.');
  } catch (err) {
    console.error('[QRCode] Erreur de migration:', err.message);
  }
}