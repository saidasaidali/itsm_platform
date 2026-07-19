// backend/src/services/keywordFrequencyCache.js
// Calcule dynamiquement la fréquence documentaire (df) de chaque mot-clé
// présent dans chatbot_learned_cases, avec cache 5 minutes.
// Remplace le tableau globalFreq codé en dur dans reranker.js.

import pool from '../db.js';

let cache = null;
let cacheTimestamp = 0;
const TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Retourne { df, totalDocs } où :
 * - df = { motCle: nombreDeDocumentsQuiLeContiennent }
 * - totalDocs = nombre total de learned_cases
 * Résultat mis en cache 5 minutes pour éviter de recalculer à chaque requête.
 */
export async function getKeywordDocFrequencies() {
  const now = Date.now();
  if (cache && now - cacheTimestamp < TTL) {
    return cache;
  }

  try {
    const { rows } = await pool.query('SELECT problem_keywords FROM chatbot_learned_cases');
    const totalDocs = rows.length;
    const df = {};

    for (const row of rows) {
      const keywords = row.problem_keywords || [];
      const uniqueInDoc = new Set(keywords.map(k => (k || '').toLowerCase()));
      for (const kw of uniqueInDoc) {
        if (!kw) continue;
        df[kw] = (df[kw] || 0) + 1;
      }
    }

    cache = { df, totalDocs: Math.max(totalDocs, 1) };
    cacheTimestamp = now;
    return cache;
  } catch (err) {
    console.error('[keywordFrequencyCache] Erreur calcul fréquences:', err.message);
    return { df: {}, totalDocs: 1 };
  }
}

/**
 * Invalide le cache (à appeler après un ajout massif de learned_cases, par exemple après syncAll())
 */
export function invalidateCache() {
  cache = null;
  cacheTimestamp = 0;
}

export default { getKeywordDocFrequencies, invalidateCache };