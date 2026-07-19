// frontend/src/services/smartAssistantService.js
// Service pour le Smart IT Assistant — envoie les messages au backend
import api from './api.js'

// Réexportations pour compatibilité avec le composant SmartAssistant existant
export { getSentimentColor } from './sentimentService.js'
export { getPriorityColor, getRiskLevelColor, formatProcessingTime } from '../utils/displayUtils.js'

/**
 * Envoyer un message au Smart Assistant (pipeline complet)
 * @param {string} message - Message de l'utilisateur
 * @param {string} sessionKey - Clé de session
 * @returns {Promise<{success: boolean, data: {response, analysis, sources, metadata}}>}
 */
export const sendMessage = async (message, sessionKey) => {
  const data = await api.post('/api/smart-assistant/chat', {
    message,
    session_key: sessionKey
  })
  return data
}

/**
 * Analyser un message sans créer de ticket (prévisualisation)
 * @param {string} message - Message à analyser
 * @returns {Promise<{success: boolean, data: {sentiment, entities, asset, classification, securityIncident}}>}
 */
export const analyzeMessage = async (message) => {
  const data = await api.post('/api/smart-assistant/analyze', { message })
  return data
}

export const getSentimentIcon = (sentiment) => {
  const icons = {
    positif: '😊',
    'très positif': '😄',
    negatif: '😟',
    'très négatif': '😠',
    neutre: '😐'
  }
  return icons[sentiment?.toLowerCase()] || '📊'
}

export const getEmotionIcon = (emotion) => {
  const icons = {
    joie: '😊',
    colère: '😠',
    tristesse: '😢',
    peur: '😨',
    surprise: '😮',
    urgence: '⚡'
  }
  return icons[emotion?.toLowerCase()] || '😐'
}