// frontend/src/services/sentimentService.js
// Service pour l'analyse de sentiment

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Analyser le sentiment d'un texte
 */
export async function analyzeText(text) {
  const response = await fetch(`${API_URL}/sentiment/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('itsm-auth-token')}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error('Erreur lors de l\'analyse de sentiment');
  }

  return response.json();
}

/**
 * Analyser le sentiment d'un ticket
 */
export async function analyzeTicketSentiment(ticketId, text) {
  const response = await fetch(`${API_URL}/sentiment/ticket/${ticketId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('itsm-auth-token')}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error('Erreur lors de l\'analyse du ticket');
  }

  return response.json();
}

/**
 * Analyser le sentiment d'un commentaire
 */
export async function analyzeCommentSentiment(commentId, text) {
  const response = await fetch(`${API_URL}/sentiment/comment/${commentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('itsm-auth-token')}`,
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error('Erreur lors de l\'analyse du commentaire');
  }

  return response.json();
}

/**
 * Récupérer les tickets critiques
 */
export async function getCriticalTickets() {
  const response = await fetch(`${API_URL}/sentiment/critical`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('itsm-auth-token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la récupération des tickets critiques');
  }

  return response.json();
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