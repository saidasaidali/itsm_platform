// frontend/src/services/sentimentService.js
// Service pour l'analyse de sentiment

import { api } from './api';

/**
 * Analyser le sentiment d'un texte
 */
export async function analyzeText(text) {
  try {
    return await api.post('/api/sentiment/analyze', { text });
  } catch (err) {
    throw new Error(err.message || 'Erreur lors de l\'analyse de sentiment');
  }
}

/**
 * Analyser le sentiment d'un ticket
 */
export async function analyzeTicketSentiment(ticketId, text) {
  try {
    return await api.post(`/api/sentiment/ticket/${ticketId}`, { text });
  } catch (err) {
    throw new Error(err.message || 'Erreur lors de l\'analyse du ticket');
  }
}

/**
 * Analyser le sentiment d'un commentaire
 */
export async function analyzeCommentSentiment(commentId, text) {
  try {
    return await api.post(`/api/sentiment/comment/${commentId}`, { text });
  } catch (err) {
    throw new Error(err.message || 'Erreur lors de l\'analyse du commentaire');
  }
}

/**
 * Récupérer les tickets critiques
 */
export async function getCriticalTickets() {
  try {
    return await api.get('/api/sentiment/critical');
  } catch (err) {
    throw new Error(err.message || 'Erreur lors de la récupération des tickets critiques');
  }
}

/**
 * Obtenir la couleur du badge selon le sentiment
 */
export function getSentimentColor(sentiment) {
  switch (sentiment) {
    case 'négatif':
      return 'danger';
    case 'légèrement négatif':
      return 'warning';
    case 'positif':
      return 'success';
    default:
      return 'secondary';
  }
}

/**
 * Obtenir l'icône selon l'émotion
 */
export function getEmotionIcon(emotion) {
  switch (emotion) {
    case 'frustration':
      return '😠';
    case 'urgence':
      return '🚨';
    case 'insatisfaction':
      return '😞';
    default:
      return '😐';
  }
}

/**
 * Formater le sentiment pour l'affichage
 */
export function formatSentiment(sentiment) {
  const labels = {
    'neutre': 'Neutre',
    'positif': 'Positif',
    'négatif': 'Négatif',
    'légèrement négatif': 'Légèrement négatif',
  };
  return labels[sentiment] || sentiment;
}