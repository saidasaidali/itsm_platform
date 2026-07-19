// backend/src/utils/dbUtils.js
// Utilitaires partagés pour les opérations base de données

import pool from '../db.js';
import { validateResourceExists } from './validationUtils.js';

/**
 * Recherche un ticket par ID et retourne 404 si non trouvé
 * @param {number} id - L'ID du ticket
 * @param {object} req - L'objet request Express
 * @param {object} res - L'objet response Express
 * @param {string} notFoundMessage - Message personnalisé (optionnel)
 * @returns {Promise<object|null>} Le ticket trouvé ou null
 */
export async function findTicketOrFail(id, req, res, notFoundMessage = null) {
  const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
  if (rows.length === 0) {
    res.status(404).json({
      success: false,
      message: notFoundMessage || (req?.t ? req.t('ticket_not_found') : 'Ticket non trouvé')
    });
    return null;
  }
  return rows[0];
}

/**
 * Exécute une requête et retourne la première ligne ou une erreur 404
 * @param {string} query - La requête SQL
 * @param {Array} params - Les paramètres de la requête
 * @param {object} req - L'objet request Express
 * @param {object} res - L'objet response Express
 * @param {string} notFoundMessage - Message personnalisé (optionnel)
 * @returns {Promise<object|null>} La première ligne ou null
 */
export async function findOneOrFail(query, params, req, res, notFoundMessage = null) {
  const { rows } = await pool.query(query, params);
  if (rows.length === 0) {
    res.status(404).json({
      success: false,
      message: notFoundMessage || 'Ressource non trouvée'
    });
    return null;
  }
  return rows[0];
}

/**
 * Ajoute un historique pour une entité
 * @param {string} table - Le nom de la table d'historique
 * @param {object} data - Les données à insérer
 */
export async function addHistoryEntry(table, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  
  await pool.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );
}