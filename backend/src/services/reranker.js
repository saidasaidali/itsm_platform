// backend/src/services/reranker.js
// Re-ranking module: hybrid scoring combining multiple signals
// Transforms raw search results into ranked, scored, deduplicated results

import { extractKeywords } from '../utils/nlpUtils.js';
import { getConfig, estimateTokens } from './ragConfig.js';
import { getKeywordDocFrequencies } from './keywordFrequencyCache.js';

/**
 * Calcule le score hybride pour chaque résultat en combinant :
 * - Score vectoriel (similarité cosinus/normalized)
 * - Score full-text (PostgreSQL ts_rank)
 * - Score de correspondance de mots-clés (TF-IDF dynamique)
 * - Score de popularité (hit_count, views)
 * - Score de fraîcheur (récence de la donnée)
 *
 * @param {Array} results - Résultats bruts des providers
 * @param {string} query - Requête originale
 * @returns {Promise<Array>} Résultats avec hybrid_score et scores détaillés
 */
export async function rerank(results, query) {
  const config = getConfig();
  const queryKeywords = extractKeywords(query);
  const now = Date.now();

  // Fréquences documentaires réelles, calculées dynamiquement depuis la DB
  // (remplace le tableau globalFreq codé en dur qui ne fonctionnait que pour 4 mots)
  const { df, totalDocs } = await getKeywordDocFrequencies();

  if (config.debugMode && results.length > 0) {
    console.log(`\n[reranker] 📊 Re-ranking de ${results.length} résultats pour: "${query.substring(0, 50)}"`);
    console.log(`[reranker] Mots-clés extraits: [${queryKeywords.join(', ')}]`);
    console.log(`[reranker] Fréquences dynamiques: totalDocs=${totalDocs}, mots-clés connus=${Object.keys(df).length}`);
  }

  // Helper : trouve la fréquence globale d'un mot-clé (fuzzy match sur les clés connues)
  // Si le mot est inconnu, on le traite comme très rare (freq=1 → poids maximal)
  function getGlobalFreq(kwLower) {
    let freq = null;
    for (const [key, val] of Object.entries(df)) {
      if (key.includes(kwLower) || kwLower.includes(key)) {
        if (freq === null || val < freq) freq = val;
      }
    }
    return freq !== null ? freq : 1;
  }

  return results.map((result, index) => {
    // 1. Score vectoriel (déjà normalisé entre 0 et 1 par pgvector cosine distance)
    // Pour les learned_case, le score n'est PAS vectoriel mais popularity+freshness
    const isLearnedCase = result.source_type === 'learned_case';
    const vectorScore = isLearnedCase ? 0 : (result.score || 0);

    // 2. Score full-text (ts_rank de PostgreSQL, généralement entre 0 et 1)
    const fullTextScore = result.fulltext_score !== undefined ? result.fulltext_score : (isLearnedCase ? 0 : (typeof result.score === 'number' ? result.score : 0));

    // 3. Score de correspondance de mots-clés avec pondération TF-IDF dynamique
    // Les mots rares (ex: "vpn") ont plus de poids que les mots fréquents (ex: "configurer")
    let keywordScore = 0;
    const metadata = result.metadata || {};

    if (result.source_type === 'learned_case' && metadata.problem_keywords) {
      const dbKeywords = metadata.problem_keywords;

      let matchedWeight = 0;
      let totalWeight = 0;

      for (const kw of queryKeywords) {
        const kwLower = kw.toLowerCase();

        // Fréquence globale dynamique (remplace le globalFreq codé en dur)
        const freq = getGlobalFreq(kwLower);
        const weight = Math.log(totalDocs / freq);
        totalWeight += weight;

        const isMatched = dbKeywords.some(dbKw =>
          dbKw.toLowerCase().includes(kwLower) || kwLower.includes(dbKw.toLowerCase())
        );
        const titleLower = (result.title || '').toLowerCase();
        const titleMatch = titleLower.includes(kwLower) || kwLower.includes(titleLower);

        if (isMatched) {
          // Bonus si le mot-clé est aussi dans le TITRE de l'article (très pertinent)
          matchedWeight += titleMatch ? weight * 2 : weight;
        }
      }

      // Plafonné à 1 (le bonus titre ×2 pouvait auparavant dépasser 1)
      keywordScore = totalWeight > 0 ? Math.min(1, matchedWeight / totalWeight) : 0;

      if (config.debugMode && queryKeywords.length > 0) {
        console.log(`[reranker]   🔍 Keywords check (learned_case): score=${keywordScore.toFixed(3)} (TF-IDF dynamique)`);
        console.log(`[reranker]   📝 problem_keywords[0..5]: [${dbKeywords.slice(0, 5).join(', ')}...]`);
      }
    } else {
      // Cas général : chercher dans le contenu et le titre
      const contentLower = (result.content || '').toLowerCase();
      const titleLower = (result.title || '').toLowerCase();
      const keywordMatches = queryKeywords.filter(kw =>
        contentLower.includes(kw) || titleLower.includes(kw)
      ).length;
      keywordScore = queryKeywords.length > 0 ? keywordMatches / queryKeywords.length : 0;

      if (config.debugMode && queryKeywords.length > 0) {
        console.log(`[reranker]   🔍 Keywords check (general): ${keywordMatches}/${queryKeywords.length} matches`);
        console.log(`[reranker]   📝 Title: "${(result.title || '').substring(0, 50)}"`);
      }
    }

    // 4. Score de popularité (basé sur hit_count, views, confidence)
    const hitCount = metadata.hit_count || 0;
    const viewsCount = metadata.views || metadata.views_count || 0;
    const confidenceScore = parseFloat(metadata.confidence_score) || 0;
    const providerPopularity = isLearnedCase ? (result.score || 0) : 0;
    const popularityScore = Math.min(
      (hitCount * 0.1 + viewsCount * 0.05 + confidenceScore * 0.5 + providerPopularity * 0.5) / 1.0,
      1.0
    );

    // 5. Score de fraîcheur (basé sur created_at/resolved_at)
    let freshnessScore = 0.5;
    const dateStr = metadata.resolved_at || metadata.created_at || null;
    if (dateStr) {
      const ageMs = now - new Date(dateStr).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      freshnessScore = Math.max(0, Math.min(1, 1 - ageDays / 365));
    }

    // Score hybride pondéré
    let hybridScore;
    if (isLearnedCase) {
      const providerScore = result.score || 0;
      hybridScore = providerScore * 0.5 + keywordScore * 0.5;
      if (config.debugMode) {
        console.log(`[reranker]   🔧 Learned_case calc: provider=${providerScore.toFixed(3)} * 0.5 + keywords=${keywordScore.toFixed(3)} * 0.5 = ${hybridScore.toFixed(3)}`);
      }
    } else {
      hybridScore = vectorScore * config.weightVector +
             fullTextScore * config.weightFulltext +
             keywordScore * config.weightKeywords +
             popularityScore * config.weightPopularity +
             freshnessScore * config.weightFreshness;
    }

    // Estimation du nombre de tokens pour le budget
    const contentTokens = estimateTokens(result.content || '');
    const titleTokens = estimateTokens(result.title || '');
    const totalTokens = contentTokens + titleTokens;

    const finalScore = Math.min(1, Math.max(0, hybridScore));

    if (config.debugMode) {
      console.log(`\n[reranker] Résultat #${index + 1}: ${(result.title || 'Sans titre').substring(0, 60)}`);
      console.log(`[reranker]   Source: ${result.source_type || result.provider || 'unknown'}`);
      console.log(`[reranker]   Scores:`);
      console.log(`[reranker]     - vector:      ${vectorScore.toFixed(3)} (poids: ${config.weightVector})`);
      console.log(`[reranker]     - fulltext:    ${fullTextScore.toFixed(3)} (poids: ${config.weightFulltext})`);
      console.log(`[reranker]     - keywords:    ${keywordScore.toFixed(3)} (poids: ${config.weightKeywords})`);
      console.log(`[reranker]     - popularity:  ${popularityScore.toFixed(3)} (poids: ${config.weightPopularity})`);
      console.log(`[reranker]     - freshness:   ${freshnessScore.toFixed(3)} (poids: ${config.weightFreshness})`);
      console.log(`[reranker]   Score hybride: ${finalScore.toFixed(3)}`);
      console.log(`[reranker]   Seuil: ${config.similarityThreshold} → ${finalScore >= config.similarityThreshold ? 'ACCEPTÉ' : 'REJETÉ'}`);
    }

    return {
      ...result,
      hybrid_score: finalScore,
      tokens: totalTokens,
      scores: {
        vector: vectorScore,
        fulltext: fullTextScore,
        keywords: keywordScore,
        popularity: popularityScore,
        freshness: freshnessScore,
        hybrid: finalScore,
      },
    };
  });
}

/**
 * Filtre les résultats par seuil de pertinence
 * @param {Array} results - Résultats après re-ranking
 * @param {number} threshold - Seuil minimal (défaut: config.similarityThreshold)
 * @returns {Array} Résultats pertinents
 */
export function filterByThreshold(results, threshold = null) {
  const config = getConfig();
  const thr = threshold !== null ? threshold : config.similarityThreshold;

  if (config.debugMode && results.length > 0) {
    console.log(`\n[reranker] 🎯 Filtrage par seuil: ${thr}`);
  }

  const filtered = results.filter(r => {
    const passes = r.hybrid_score >= thr;
    if (config.debugMode) {
      const status = passes ? '✅ ACCEPTÉ' : '❌ REJETÉ';
      console.log(`[reranker]   ${status}: "${(r.title || 'Sans titre').substring(0, 60)}" (score: ${r.hybrid_score.toFixed(3)})`);
    }
    return passes;
  });

  if (config.debugMode) {
    console.log(`[reranker]   📊 ${filtered.length}/${results.length} résultats retenus après filtrage`);
  }

  return filtered;
}

/**
 * Supprime les doublons basés sur la similarité de contenu
 * @param {Array} results - Résultats avec hybrid_score
 * @returns {Array} Résultats dédupliqués
 */
export function deduplicate(results) {
  const unique = [];
  const seen = new Set();

  if (results.length === 0) return unique;

  const config = getConfig();
  if (config.debugMode) {
    console.log(`\n[reranker] 🔍 Déduplication de ${results.length} résultats...`);
  }

  for (const result of results) {
    const normalized = ((result.title || '') + ' ' + (result.content || ''))
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);

    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(result);
    } else if (config.debugMode) {
      console.log(`[reranker]   ❌ Dédupliqué: "${(result.title || 'Sans titre').substring(0, 60)}"`);
    }
  }

  if (config.debugMode) {
    console.log(`[reranker]   ✅ ${unique.length} résultats uniques après déduplication (${results.length - unique.length} supprimés)`);
  }

  return unique;
}

/**
 * Sélectionne les meilleurs résultats en respectant une répartition équitable entre les sources
 * @param {Array} results - Résultats re-ranked et filtrés
 * @param {number} maxTotal - Nombre total maximum à garder
 * @returns {Array} Résultats sélectionnés
 */
export function selectTopResults(results, maxTotal = null) {
  const config = getConfig();
  const max = maxTotal || config.maxResults;

  const sorted = [...results].sort((a, b) => b.hybrid_score - a.hybrid_score);

  if (config.debugMode) {
    console.log(`\n[reranker] 🏆 Sélection des top ${max} résultats parmi ${sorted.length}`);
    sorted.forEach((r, i) => {
      console.log(`[reranker]   #${i + 1}: "${(r.title || 'Sans titre').substring(0, 60)}" (${r.source_type || r.provider || 'unknown'}) - score: ${r.hybrid_score.toFixed(3)}`);
    });
  }

  const byProvider = {};
  for (const r of sorted) {
    const provider = r.provider || r.source_type || 'unknown';
    if (!byProvider[provider]) byProvider[provider] = [];
    byProvider[provider].push(r);
  }

  const distributed = [];
  const indices = {};
  let remaining = max;

  while (remaining > 0) {
    let added = false;
    for (const provider of Object.keys(byProvider)) {
      if (!indices[provider]) indices[provider] = 0;
      if (indices[provider] < byProvider[provider].length && remaining > 0) {
        const selected = byProvider[provider][indices[provider]];
        distributed.push(selected);
        indices[provider]++;
        remaining--;
        added = true;

        if (config.debugMode) {
          console.log(`[reranker]   ✅ Sélectionné: "${(selected.title || 'Sans titre').substring(0, 60)}" (${provider})`);
        }
      }
    }
    if (!added) break;
  }

  if (config.debugMode) {
    console.log(`[reranker]   📊 ${distributed.length} résultats finaux sélectionnés`);
  }

  return distributed;
}

/**
 * Pipeline complet de re-ranking : déduplication → scoring → filtrage → sélection
 * @param {Array} rawResults - Résultats bruts des providers
 * @param {string} query - Requête originale
 * @param {object} options - Options optionnelles
 * @returns {Promise<{ results: Array, metrics: object }>}
 */
export async function rerankPipeline(rawResults, query, options = {}) {
  const t0 = Date.now();
  const config = getConfig();

  const threshold = options.threshold || config.similarityThreshold;
  const maxResults = options.maxResults || config.maxResults;

  // 1. Déduplication
  const unique = deduplicate(rawResults);
  const t1 = Date.now();

  // 2. Re-ranking (scoring hybride) — maintenant async (fréquences chargées depuis la DB)
  const scored = await rerank(unique, query);
  const t2 = Date.now();

  // 3. Filtrage par seuil
  const filtered = filterByThreshold(scored, threshold);
  const t3 = Date.now();

  // 4. Sélection Top-K équitable
  const selected = selectTopResults(filtered, maxResults);
  const t4 = Date.now();

  return {
    results: selected,
    metrics: {
      totalDuration: Date.now() - t0,
      inputCount: rawResults.length,
      afterDedup: unique.length,
      afterScoring: scored.length,
      afterThreshold: filtered.length,
      finalCount: selected.length,
      timing: {
        dedup: t1 - t0,
        scoring: t2 - t1,
        filtering: t3 - t2,
        selection: t4 - t3,
      },
    },
  };
}

export default {
  rerank,
  filterByThreshold,
  deduplicate,
  selectTopResults,
  rerankPipeline,
};