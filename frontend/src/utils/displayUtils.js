// frontend/src/utils/displayUtils.js
// Utilitaires d'affichage partagés (couleurs, icônes, formatage)

/**
 * Formater le temps de traitement en ms
 * @param {number} ms - Temps en millisecondes
 * @returns {string} Temps formaté
 */
export function formatProcessingTime(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Obtenir la couleur du sentiment
 * @param {string} sentiment - Type de sentiment
 * @returns {string} Couleur CSS
 */
export function getSentimentColor(sentiment) {
  const colors = {
    'positif': '#28a745',
    'neutre': '#6c757d',
    'légèrement négatif': '#ffc107',
    'négatif': '#fd7e14',
    'très négatif': '#dc3545'
  };
  return colors[sentiment] || '#6c757d';
}

/**
 * Obtenir l'icône du sentiment
 * @param {string} sentiment - Type de sentiment
 * @returns {string} Icône emoji
 */
export function getSentimentIcon(sentiment) {
  const icons = {
    'positif': '😊',
    'neutre': '😐',
    'légèrement négatif': '😕',
    'négatif': '😠',
    'très négatif': '😡'
  };
  return icons[sentiment] || '😐';
}

/**
 * Obtenir la couleur de priorité
 * @param {string} priority - Niveau de priorité
 * @returns {string} Couleur CSS
 */
export function getPriorityColor(priority) {
  const colors = {
    'Normale': '#28a745',
    'Moyenne': '#ffc107',
    'Haute': '#fd7e14',
    'Critique': '#dc3545'
  };
  return colors[priority] || '#6c757d';
}

/**
 * Obtenir la couleur du niveau de risque
 * @param {string} riskLevel - Niveau de risque
 * @returns {string} Couleur CSS
 */
export function getRiskLevelColor(riskLevel) {
  const colors = {
    'faible': '#28a745',
    'moyen': '#ffc107',
    'élevé': '#fd7e14',
    'critique': '#dc3545'
  };
  return colors[riskLevel] || '#6c757d';
}