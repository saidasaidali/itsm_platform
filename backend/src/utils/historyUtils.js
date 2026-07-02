// backend/src/utils/historyUtils.js
// Utilitaires partagés pour l'historique des entités

import pool from '../db.js';

/**
 * Ajoute une entrée d'historique pour un ticket
 * @param {number} ticketId - L'ID du ticket
 * @param {number} userId - L'ID de l'utilisateur qui a effectué l'action
 * @param {string} action - Le type d'action (created, status_change, comment_added, etc.)
 * @param {string|null} oldValue - L'ancienne valeur
 * @param {string|null} newValue - La nouvelle valeur
 */
export async function addTicketHistory(ticketId, userId, action, oldValue = null, newValue = null) {
  await pool.query(
    `INSERT INTO ticket_history (ticket_id, user_id, action, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5)`,
    [ticketId, userId, action, oldValue, newValue]
  );
}

/**
 * Ajoute une entrée d'historique pour un asset
 * @param {number} assetId - L'ID de l'asset
 * @param {number} userId - L'ID de l'utilisateur
 * @param {string} actionType - Le type d'action
 * @param {string} action - La description de l'action
 * @param {string|null} oldValue - L'ancienne valeur
 * @param {string|null} newValue - La nouvelle valeur
 */
export async function addAssetHistory(assetId, userId, actionType, action, oldValue = null, newValue = null) {
  await pool.query(
    `INSERT INTO asset_history (asset_id, user_id, action_type, action, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [assetId, userId, actionType, action, oldValue, newValue]
  );
}