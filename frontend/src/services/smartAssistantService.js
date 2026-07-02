// frontend/src/services/smartAssistantService.js
// Service pour le Smart IT Assistant

import api from './api';
import { formatProcessingTime, getSentimentColor, getSentimentIcon, getPriorityColor, getRiskLevelColor } from '../utils/displayUtils';

// Réexporter les utilitaires d'affichage
export { formatProcessingTime, getSentimentColor, getSentimentIcon, getPriorityColor, getRiskLevelColor };

/**
 * Envoyer un message au Smart Assistant
 * @param {string} message - Message de l'utilisateur
 * @param {string} sessionKey - Clé de session (optionnel)
 * @returns {Promise<Object>} Réponse du Smart Assistant
 */
export async function sendMessage(message, sessionKey = null) {
  try {
    const response = await api.post('/smart-assistant/chat', {
      message,
      session_key: sessionKey
    });
    return response.data;
  } catch (error) {
    console.error('[SmartAssistant] Erreur envoi message:', error);
    throw error;
  }
}

/**
 * Analyser un message sans créer de ticket (prévisualisation)
 * @param {string} message - Message à analyser
 * @returns {Promise<Object>} Analyse du message
 */
export async function analyzeMessage(message) {
  try {
    const response = await api.post('/smart-assistant/analyze', {
      message
    });
    return response.data;
  } catch (error) {
    console.error('[SmartAssistant] Erreur analyse message:', error);
    throw error;
  }
}

/**
 * Obtenir les statistiques du Smart Assistant
 * @param {number} days - Nombre de jours à consulter (défaut: 7)
 * @returns {Promise<Array>} Statistiques
 */
export async function getStats(days = 7) {
  try {
    const response = await api.get(`/smart-assistant/stats?days=${days}`);
    return response.data.data;
  } catch (error) {
    console.error('[SmartAssistant] Erreur getStats:', error);
    throw error;
  }
}

/**
 * Obtenir les incidents de sécurité actifs
 * @param {string} status - Statut des incidents ('open' par défaut)
 * @returns {Promise<Array>} Liste des incidents
 */
export async function getSecurityIncidents(status = 'open') {
  try {
    const response = await api.get(`/smart-assistant/security-incidents?status=${status}`);
    return response.data.data;
  } catch (error) {
    console.error('[SmartAssistant] Erreur getSecurityIncidents:', error);
    throw error;
  }
}

/**
 * Mettre à jour le statut d'un incident de sécurité
 * @param {number} incidentId - ID de l'incident
 * @param {Object} updates - Mises à jour à appliquer
 * @returns {Promise<Object>} Incident mis à jour
 */
export async function updateSecurityIncident(incidentId, updates) {
  try {
    const response = await api.patch(`/smart-assistant/security-incidents/${incidentId}`, updates);
    return response.data.data;
  } catch (error) {
    console.error('[SmartAssistant] Erreur updateSecurityIncident:', error);
    throw error;
  }
}

/**
 * Obtenir l'historique d'une session
 * @param {string} sessionKey - Clé de session
 * @param {number} limit - Nombre maximum de messages (défaut: 50)
 * @returns {Promise<Array>} Historique des messages
 */
export async function getSessionHistory(sessionKey, limit = 50) {
  try {
    const response = await api.get(`/smart-assistant/session/${sessionKey}?limit=${limit}`);
    return response.data.data;
  } catch (error) {
    console.error('[SmartAssistant] Erreur getSessionHistory:', error);
    throw error;
  }
}

/**
 * Obtenir les métriques en temps réel
 * @returns {Promise<Object>} Métriques du jour
 */
export async function getRealtimeMetrics() {
  try {
    const response = await api.get('/smart-assistant/metrics/realtime');
    return response.data.data;
  } catch (error) {
    console.error('[SmartAssistant] Erreur getRealtimeMetrics:', error);
    throw error;
  }
}

export default {
  sendMessage,
  analyzeMessage,
  getStats,
  getSecurityIncidents,
  updateSecurityIncident,
  getSessionHistory,
  getRealtimeMetrics
};
