// backend/src/middlewares/calendarCacheMiddleware.js
// Cache middleware pour optimiser les requêtes calendrier fréquentes

let statsCache = null;
let statsCacheTime = 0;
const STATS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let autoEventsCache = null;
let autoEventsCacheTime = 0;
const AUTO_EVENTS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Cache pour les statistiques du calendrier
 */
export function getCachedStats(userId, role) {
  const cacheKey = `${userId}-${role}`;
  const now = Date.now();
  
  if (statsCache && statsCache.key === cacheKey && (now - statsCacheTime) < STATS_CACHE_DURATION) {
    return statsCache.data;
  }
  
  return null;
}

export function setCachedStats(userId, role, data) {
  statsCache = {
    key: `${userId}-${role}`,
    data: data
  };
  statsCacheTime = Date.now();
}

/**
 * Cache pour les événements automatiques
 */
export function getCachedAutoEvents() {
  const now = Date.now();
  
  if (autoEventsCache && (now - autoEventsCacheTime) < AUTO_EVENTS_CACHE_DURATION) {
    return autoEventsCache;
  }
  
  return null;
}

export function setCachedAutoEvents(data) {
  autoEventsCache = data;
  autoEventsCacheTime = Date.now();
}

/**
 * Invalide le cache des statistiques
 */
export function invalidateStatsCache() {
  statsCache = null;
  statsCacheTime = 0;
}

/**
 * Invalide le cache des événements automatiques
 */
export function invalidateAutoEventsCache() {
  autoEventsCache = null;
  autoEventsCacheTime = 0;
}

export default {
  getCachedStats,
  setCachedStats,
  getCachedAutoEvents,
  setCachedAutoEvents,
  invalidateStatsCache,
  invalidateAutoEventsCache
};