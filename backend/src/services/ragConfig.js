// backend/src/services/ragConfig.js
// Centralized RAG configuration loaded from .env with defaults
// Shared between ragService.js and knowledgeProviders

import { getSettings } from './settingsService.js';

/**
 * Returns the current RAG configuration.
 * Values are read dynamically so changes to .env or settings take effect without restart.
 */
export function getConfig() {
  const s = getSettings();
  // PRIORITÉ: .env > database > defaults
  // Les valeurs .env sont prioritaires pour les performances
  return {
    // Ollama
    model: process.env.OLLAMA_MODEL || s.ollama_model || 'llama3.2',
    host: process.env.OLLAMA_URL || s.ollama_url || 'http://localhost:11434',
    temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || s.ollama_temperature || '0.3'),
    numPredict: parseInt(process.env.OLLAMA_NUM_PREDICT || s.ollama_num_predict || '300', 10),
    numCtx: parseInt(process.env.OLLAMA_NUM_CTX || s.ollama_num_ctx || '4096', 10),
    topK: parseInt(process.env.OLLAMA_TOP_K || s.ollama_top_k || '40', 10),
    topP: parseFloat(process.env.OLLAMA_TOP_P || s.ollama_top_p || '0.9'),
    repeatPenalty: parseFloat(process.env.OLLAMA_REPEAT_PENALTY || s.ollama_repeat_penalty || '1.05'),
    timeout: parseInt(process.env.OLLAMA_TIMEOUT_MS || s.ollama_timeout_ms || '60000', 10),

    // RAG thresholds
    maxResults: parseInt(process.env.RAG_MAX_RESULTS || s.rag_max_results || '4', 10),
    similarityThreshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || s.rag_similarity_threshold || '0.50'),
    confidenceSkipLlm: parseFloat(process.env.RAG_CONFIDENCE_SKIP_LLM || '0.9'),
    contextTokenBudget: parseInt(process.env.RAG_CONTEXT_TOKEN_BUDGET || '1800', 10),
    promptOverheadTokens: parseInt(process.env.RAG_PROMPT_OVERHEAD_TOKENS || '2048', 10),

    // Hybrid score weights (must sum to 1.0)
    weightVector: parseFloat(process.env.RAG_WEIGHT_VECTOR || '0.40'),
    weightFulltext: parseFloat(process.env.RAG_WEIGHT_FULLTEXT || '0.30'),
    weightKeywords: parseFloat(process.env.RAG_WEIGHT_KEYWORDS || '0.15'),
    weightPopularity: parseFloat(process.env.RAG_WEIGHT_POPULARITY || '0.10'),
    weightFreshness: parseFloat(process.env.RAG_WEIGHT_FRESHNESS || '0.05'),

    // Per-source limits
    maxPdfChunks: parseInt(process.env.RAG_MAX_PDF_CHUNKS || '5', 10),
    maxKbArticles: parseInt(process.env.RAG_MAX_KB_ARTICLES || '5', 10),
    maxResolvedTickets: parseInt(process.env.RAG_MAX_RESOLVED_TICKETS || '5', 10),
    maxLearnedCases: parseInt(process.env.RAG_MAX_LEARNED_CASES || '3', 10),

    debugMode: process.env.RAG_DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development' || s.debug_mode === 'true',
  };
}

/**
 * Estimate number of tokens from a text (rough approximation: 1 token ≈ 4 chars for French)
 */
export function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimation: 1 token = ~4 characters (varies by language, but a safe bet for French/English)
  return Math.ceil(text.length / 4);
}

export default { getConfig, estimateTokens };