// backend/src/utils/sentimentUtils.js
// Utilitaires partagés pour l'analyse de sentiment des tickets et commentaires
// Factorise la logique dupliquée entre createTicket et addComment dans ticketController.js

import pool from '../db.js';
import { analyzeSentiment, getSentimentActions } from '../services/sentimentAnalyzer.js';
import { notifyAdmins } from '../services/notificationService.js';

/**
 * Met à jour la priorité d'un ticket si le sentiment est critique
 * @param {number} ticketId - L'ID du ticket
 * @param {boolean} shouldMarkCritical - Si le sentiment est critique
 * @param {string} currentPriority - La priorité actuelle
 * @param {object} pool - La connexion pool
 */
export async function updatePriorityIfCritical(ticketId, shouldMarkCritical, currentPriority) {
  if (shouldMarkCritical && currentPriority !== 'Haute') {
    await pool.query(`UPDATE tickets SET priority = 'Haute' WHERE id = $1`, [ticketId]);
    return 'Haute';
  }
  return currentPriority;
}

/**
 * Analyse le sentiment d'un texte et met à jour l'entité correspondante (ticket ou commentaire)
 * @param {string} text - Le texte à analyser
 * @param {string} entityType - Le type d'entité ('tickets' ou 'ticket_comments')
 * @param {number} entityId - L'ID de l'entité à mettre à jour
 * @param {number} ticketId - L'ID du ticket (pour les notifications)
 * @param {string} ticketTitle - Le titre du ticket (pour les notifications)
 * @param {string|null} notificationType - Type de notification ('sentiment_alert' ou 'comment_sentiment_alert')
 * @param {string} currentPriority - Priorité actuelle du ticket (optionnel, pour mise à jour si critique)
 * @returns {Promise<Object>} { sentimentResult, sentimentActions, updatedPriority }
 */
export async function analyzeAndSaveSentiment(text, entityType, entityId, ticketId, ticketTitle = '', notificationType = null, currentPriority = null) {
  const sentimentResult = analyzeSentiment(text);
  const sentimentActions = getSentimentActions(text);

  // Colonnes de sentiment (sentiment_analyzed_at n'existe que dans tickets, pas ticket_comments)
  const isTicket = entityType === 'tickets';
  const setClause = isTicket
    ? `sentiment = $1, sentiment_score = $2, sentiment_emotions = $3,
       sentiment_intensity = $4, sentiment_is_critical = $5,
       sentiment_analyzed_at = NOW()`
    : `sentiment = $1, sentiment_score = $2, sentiment_emotions = $3,
       sentiment_intensity = $4, sentiment_is_critical = $5`;
  
  // Analyse de sentiment
  await pool.query(
    `UPDATE ${entityType} SET ${setClause} WHERE id = $6`,
    [
      sentimentResult.sentiment,
      sentimentResult.score,
      JSON.stringify(sentimentResult.emotions),
      sentimentResult.intensity,
      sentimentActions.shouldMarkCritical || sentimentResult.isCritical,
      entityId,
    ]
  );

  // Mettre à jour la priorité si critique et que c'est un ticket
  let updatedPriority = currentPriority;
  if (entityType === 'tickets' && currentPriority && (sentimentActions.shouldMarkCritical || sentimentResult.isCritical)) {
    updatedPriority = await updatePriorityIfCritical(ticketId, true, currentPriority);
  }

  // Notification si critique
  if (sentimentResult.isCritical || sentimentActions.shouldNotifyManager) {
    const notificationData = {
      type: notificationType || 'sentiment_alert',
      ticketId,
      ticketTitle,
      sentiment: sentimentResult.sentiment,
      score: sentimentResult.score,
      emotions: sentimentResult.emotions,
    };

    if (notificationType === 'comment_sentiment_alert') {
      notificationData.commentId = entityId;
    } else {
      notificationData.reasons = sentimentActions.reason;
      notificationData.priority = sentimentActions.priority;
    }

    notifyAdmins(notificationData).catch(() => {});
  }

  return { sentimentResult, sentimentActions, updatedPriority };
}
