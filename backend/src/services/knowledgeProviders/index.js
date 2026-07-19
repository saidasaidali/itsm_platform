// backend/src/services/knowledgeProviders/index.js
// Interface unifiée pour tous les fournisseurs de connaissances du pipeline RAG
// Chaque provider expose : search(query, limit) → { results: [...], metrics: { duration, count } }

import { knowledgeBaseProvider } from './knowledgeBaseProvider.js';
import { pdfProvider } from './pdfProvider.js';
import { resolvedTicketsProvider } from './resolvedTicketsProvider.js';
import { learnedCasesProvider } from './learnedCasesProvider.js';

// Liste ordonnée des providers (l'ordre détermine la priorité d'affichage dans le prompt)
export const ALL_PROVIDERS = [
  knowledgeBaseProvider,
  pdfProvider,
  resolvedTicketsProvider,
  learnedCasesProvider,
];

/**
 * Interroge tous les providers en parallèle et fusionne les résultats
 * @param {string} query - La requête utilisateur
 * @param {object} options - Options de recherche
 * @param {number} options.limitPerSource - Limite par source (défaut: 5)
 * @returns {Promise<{results: Array, metrics: object}>}
 */
export async function searchAllProviders(query, options = {}) {
  const {
    limitPerSource = 5,
  } = options;

  const startTime = Date.now();
  const sourceMetrics = {};

  // Filtrer les providers selon la configuration
  const includePdf = process.env.RAG_INCLUDE_PDF === 'true';
  const providersToSearch = ALL_PROVIDERS.filter(provider => {
    if (provider.name === 'internal_document' && !includePdf) {
      return false;
    }
    return true;
  });

  if (!includePdf && providersToSearch.length < ALL_PROVIDERS.length) {
    console.log('[knowledgeProviders] PDF exclus de la recherche (RAG_INCLUDE_PDF=false)');
  }

  const searches = providersToSearch.map(async (provider) => {
    const t0 = Date.now();
    try {
      const result = await provider.search(query, limitPerSource);
      const duration = Date.now() - t0;
      sourceMetrics[provider.name] = {
        count: result.length,
        duration,
        success: true,
      };
      return result.map(item => ({
        ...item,
        provider: provider.name,
      }));
    } catch (err) {
      const duration = Date.now() - t0;
      sourceMetrics[provider.name] = {
        count: 0,
        duration,
        success: false,
        error: err.message,
      };
      console.error(`[knowledgeProviders] Erreur ${provider.name}: ${err.message}`);
      return [];
    }
  });

  const nestedResults = await Promise.all(searches);
  const allResults = nestedResults.flat();

  const totalDuration = Date.now() - startTime;

  return {
    results: allResults,
    metrics: {
      totalDuration,
      sourceMetrics,
      totalSources: allResults.length,
      providersCount: ALL_PROVIDERS.length,
    },
  };
}

/**
 * Réinitialise les caches de tous les providers (si supporté)
 */
export function clearAllProviderCaches() {
  ALL_PROVIDERS.forEach(provider => {
    if (typeof provider.clearCache === 'function') {
      provider.clearCache();
    }
  });
}

export default {
  searchAllProviders,
  clearAllProviderCaches,
  ALL_PROVIDERS,
};