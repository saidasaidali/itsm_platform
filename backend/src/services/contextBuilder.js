// backend/src/services/contextBuilder.js
// Context builder with token budget management
// Allocates the available token budget to the best-ranked results

import { getConfig, estimateTokens } from './ragConfig.js';

/**
 * Builds a context string respecting a token budget.
 * Allocates tokens to the best results first, truncating content if needed.
 *
 * @param {Array} results - Ranked results with hybrid_score and tokens
 * @param {object} options
 * @param {number} options.tokenBudget - Max tokens for context (default: config.contextTokenBudget)
 * @param {number} options.maxResults - Max results to include (default: config.maxResults)
 * @param {boolean} options.includeSources - Include source prefixes (default: true)
 * @returns {{ context: string, usedTokens: number, includedResults: Array, excludedResults: Array }}
 */
export function buildContext(results, options = {}) {
  const config = getConfig();
  const tokenBudget = options.tokenBudget || config.contextTokenBudget;
  const maxResults = options.maxResults || config.maxResults;
  const includeSources = options.includeSources !== false;

  // Trier par score hybride descendant
  const sorted = [...results].sort((a, b) => b.hybrid_score - a.hybrid_score);

  const includedResults = [];
  const excludedResults = [];
  let usedTokens = 0;
  let context = '';

  for (const result of sorted) {
    if (includedResults.length >= maxResults) {
      excludedResults.push(result);
      continue;
    }

    // Construire l'en-tête de source
    let header = '';
    if (includeSources) {
      header = formatSourceHeader(result);
    }

    // Contenu : on privilégie le contenu complet, avec troncature seulement si nécessaire
    const content = result.content || '';
    const headerTokens = estimateTokens(header);
    const contentTokens = estimateTokens(content);
    const totalItemTokens = headerTokens + contentTokens + 10; // +10 pour séparateurs

    // Vérifier si l'item tient dans le budget restant
    if (usedTokens + totalItemTokens <= tokenBudget) {
      // L'item tient entièrement → on l'inclut COMPLET
      context += header + content + '\n\n';
      usedTokens += totalItemTokens;
      includedResults.push(result);
    } else {
      // Essayer avec contenu tronqué intelligemment
      const remainingTokens = tokenBudget - usedTokens - headerTokens - 20; // 20 pour marge
      if (remainingTokens > 100) {
        // Tronquer à la phrase la plus proche, mais garder le plus de contenu possible
        const truncatedContent = truncateToTokenBudget(content, remainingTokens);
        context += header + truncatedContent + '\n\n';
        usedTokens += headerTokens + estimateTokens(truncatedContent) + 10;
        includedResults.push({ ...result, truncated: true });
      } else {
        // Pas assez de place pour ce résultat
        excludedResults.push(result);
      }
    }
  }

  return {
    context: context.trim(),
    usedTokens,
    includedResults,
    excludedResults,
  };
}

/**
 * Formatte l'en-tête de source pour un résultat
 */
function formatSourceHeader(result) {
  const type = result.source_type || result.provider || 'unknown';
  const title = result.title || 'Sans titre';
  const score = result.hybrid_score ? `(pertinence: ${(result.hybrid_score * 100).toFixed(0)}%)` : '';

  switch (type) {
    case 'knowledge_base':
      return `[Article KB: ${title}] ${score}\n`;
    case 'internal_document':
      return `[Document: ${title}] ${score}\n`;
    case 'resolved_ticket':
      return `[${title}] ${score}\n`;
    case 'learned_case':
      return `[Procédure: ${title}] ${score}\n`;
    default:
      return `[Source: ${title}] ${score}\n`;
  }
}

/**
 * Tronque un texte pour respecter un budget de tokens
 */
function truncateToTokenBudget(text, maxTokens) {
  if (!text) return '';
  
  // Approximation : 1 token ≈ 4 caractères
  const maxChars = maxTokens * 4;
  
  if (text.length <= maxChars) return text;
  
  // Tronquer à la phrase la plus proche
  const truncated = text.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastPeriod, lastNewline);
  
  if (breakPoint > maxChars * 0.5) {
    return truncated.substring(0, breakPoint + 1) + '...';
  }
  
  return truncated + '...';
}

/**
 * Calcule le budget de tokens disponible pour le contexte
 * @param {object} analysis - Analyse optionnelle (sentiment, classification, etc.)
 * @param {Array} conversationHistory - Historique de conversation
 * @returns {number} Budget de tokens pour le contexte
 */
export function calculateAvailableBudget(analysis = null, conversationHistory = []) {
  const config = getConfig();
  
  // Budget total = numCtx - overhead du prompt
  let budget = config.contextTokenBudget;
  
  // Réduire le budget si l'analyse est longue
  if (analysis) {
    const analysisStr = JSON.stringify(analysis);
    budget -= estimateTokens(analysisStr);
  }
  
  // Réduire le budget si l'historique est long
  if (conversationHistory.length > 0) {
    const historyStr = conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n');
    budget -= estimateTokens(historyStr);
  }
  
  return Math.max(512, budget); // Minimum 512 tokens
}

export { formatSourceHeader };
export default {
  buildContext,
  calculateAvailableBudget,
  formatSourceHeader,
};
