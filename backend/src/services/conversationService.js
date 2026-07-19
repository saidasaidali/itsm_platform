/**
 * Service de cache conversationnel unifié
 * Fusionne conversationCache.js (Smart Assistant) et ragService.conversationContextCache (Chatbot)
 * 
 * Structure de state stockée par session :
 * {
 *   pendingAction: null | 'create_ticket' | 'incident_resolved',
 *   lastIntent: null | string,
 *   lastQuestion: null | string,
 *   lastResponse: null | string,
 *   lastKnowledge: [],        // array d'objets knowledge
 *   lastArticles: [],         // array d'articles KB
 *   lastDocuments: [],        // array de documents
 *   lastCategory: null | string,
 *   lastPriority: null | string,
 *   lastAsset: null | object,
 *   lastTechnician: null | object,
 *   history: [],              // [{ role: 'user'|'assistant', content: string }] — ajouté pour compatibilité Chatbot
 *   createdAt: Date
 * }
 */

const conversationCache = new Map();
const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Charge l'état d'une session
 * @param {string} sessionKey - Clé de session
 * @returns {object|null} État de la session ou null si inexistant/expiré
 */
export function loadConversationState(sessionKey) {
  const cached = conversationCache.get(sessionKey);
  if (cached && Date.now() - cached.lastAccess < cached.ttl) {
    cached.lastAccess = Date.now();
    return cached.state;
  }
  if (cached) conversationCache.delete(sessionKey);
  return null;
}

/**
 * Sauvegarde l'état d'une session
 * @param {string} sessionKey - Clé de session
 * @param {object} state - État à stocker
 * @param {number} ttl - Durée de vie en ms (défaut: 30 min)
 */
export function saveConversationState(sessionKey, state, ttl = DEFAULT_TTL) {
  conversationCache.set(sessionKey, {
    state,
    lastAccess: Date.now(),
    ttl
  });
}

/**
 * Supprime l'état d'une session
 * @param {string} sessionKey - Clé de session
 */
export function resetConversationState(sessionKey) {
  conversationCache.delete(sessionKey);
}

/**
 * Vérifie si une session a un état valide (non expiré)
 * @param {string} sessionKey - Clé de session
 * @returns {boolean}
 */
export function hasConversationState(sessionKey) {
  const cached = conversationCache.get(sessionKey);
  return cached && Date.now() - cached.lastAccess < cached.ttl;
}

/**
 * Retourne les statistiques du cache
 * @returns {{ total: number, active: number }}
 */
export function getCacheStats() {
  const total = conversationCache.size;
  const now = Date.now();
  let active = 0;
  for (const s of conversationCache.values()) {
    if (now - s.lastAccess < s.ttl) active++;
  }
  return { total, active };
}

/**
 * Vide toutes les sessions du cache
 */
export function clearAllSessions() {
  conversationCache.clear();
}

/**
 * Ajoute un message à l'historique d'une session
 * @param {string} sessionKey - Clé de session
 * @param {string} role - 'user' ou 'assistant'
 * @param {string} content - Contenu du message
 * @param {number} maxMessages - Nombre max de messages à conserver (défaut: 6 = 3 échanges)
 */
export function addHistoryMessage(sessionKey, role, content, maxMessages = 6) {
  const state = loadConversationState(sessionKey);
  if (!state) return;
  
  if (!state.history) state.history = [];
  state.history.push({ role, content });
  
  // Conserver uniquement les N derniers messages
  if (state.history.length > maxMessages) {
    state.history = state.history.slice(-maxMessages);
  }
  
  saveConversationState(sessionKey, state);
}

/**
 * Récupère l'historique des messages d'une session
 * @param {string} sessionKey - Clé de session
 * @param {number} maxMessages - Nombre max de messages à retourner (défaut: 6)
 * @returns {Array<{role: string, content: string}>}
 */
export function getHistory(sessionKey, maxMessages = 6) {
  const state = loadConversationState(sessionKey);
  if (!state || !state.history) return [];
  return state.history.slice(-maxMessages);
}

export default {
  loadConversationState,
  saveConversationState,
  resetConversationState,
  hasConversationState,
  getCacheStats,
  clearAllSessions,
  addHistoryMessage,
  getHistory
};