// backend/src/services/ragService.js
// Service RAG partagé entre chatbotBrain.js et smartAssistantService.js
// Centralise : recherche vectorielle PDF, construction du prompt, appel Ollama
// Utilise l'architecture modulaire : providers → reranker → contextBuilder → Ollama

import ollama from 'ollama';
import { getConfig, estimateTokens } from './ragConfig.js';
import { searchAllProviders } from './knowledgeProviders/index.js';
import { rerankPipeline } from './reranker.js';
import { buildContext, calculateAvailableBudget } from './contextBuilder.js';
import pdfIndexer from './pdfIndexer.js';

// ─── Cache intelligent pour les réponses ──────────────────────────────────
const responseCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes en millisecondes

// ─── Recherche vectorielle dans les chunks PDF (legacy) ────────────────────
export async function searchDocumentChunks(query, limit = 3) {
  const startTime = Date.now();
  try {
    const result = await pdfIndexer.searchDocumentChunks(query, limit);
    const duration = Date.now() - startTime;
    if (result.success && result.data) {
      console.log(`[ragService] Recherche vectorielle: ${result.data.length} chunks trouvés en ${duration}ms`);
      return result.data;
    }
    console.warn(`[ragService] Aucun chunk trouvé (${duration}ms)`);
    return [];
  } catch (err) {
    console.error(`[ragService] Erreur recherche vectorielle: ${err.message}`);
    return [];
  }
}

// ─── Recherche unifiée via l'architecture modulaire ────────────────────────
export async function searchUnifiedKnowledge(query, limit = 5) {
  const startTime = Date.now();
  const config = getConfig();

  try {
    // 1. Interroger tous les providers en parallèle
    const { results: rawResults, metrics: searchMetrics } = await searchAllProviders(query, {
      limitPerSource: limit * 2,
    });

    // 2. Re-ranking (déduplication → scoring hybride → filtrage → sélection)
    // CORRECTION : await ajouté car rerankPipeline est maintenant async (rerank() charge les fréquences depuis la DB)
    const { results: rankedResults, metrics: rerankMetrics } = await rerankPipeline(rawResults, query, {
      maxResults: config.maxResults,
      threshold: config.similarityThreshold,
    });

    const totalDuration = Date.now() - startTime;

    // Logs détaillés en mode debug
    if (config.debugMode) {
      console.log(`\n${'═'.repeat(80)}`);
      console.log(`RECHERCHE UNIFIÉE (modulaire): "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
      console.log(`Sources interrogées: ${searchMetrics.totalSources} résultats bruts`);
      console.log(`Après re-ranking: ${rerankMetrics.finalCount} résultats retenus (seuil: ${config.similarityThreshold})`);
      console.log(`Détail re-ranking: ${rerankMetrics.inputCount} entrées → ${rerankMetrics.afterDedup} dédupl. → ${rerankMetrics.afterThreshold} filtrés → ${rerankMetrics.finalCount} sélectionnés`);
      console.log(`Timing re-ranking: dédup=${rerankMetrics.timing.dedup}ms, scoring=${rerankMetrics.timing.scoring}ms, filtrage=${rerankMetrics.timing.filtering}ms, sélection=${rerankMetrics.timing.selection}ms`);
      console.log(`Durée totale recherche: ${totalDuration}ms`);
      console.log('═'.repeat(80) + '\n');
    }

    return rankedResults;

  } catch (err) {
    console.error(`[ragService] Erreur recherche unifiée: ${err.message}`);
    return [];
  }
}

// ─── Appel à Ollama (llama3.2) avec keep_alive et streaming ───────────────
export async function callOllama(prompt, onStream = null) {
  const startTime = Date.now();
  const config = getConfig();

  try {
    console.log(`[ragService] Appel Ollama (modèle: ${config.model}, ctx: ${config.numCtx}, predict: ${config.numPredict}, keep_alive: 5min)...`);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout Ollama après ${config.timeout}ms`)), config.timeout);
    });

    const ollamaPromise = ollama.generate({
      model: config.model,
      prompt: prompt,
      stream: onStream ? true : false,
      options: {
        temperature: config.temperature,
        num_predict: config.numPredict,
        num_ctx: config.numCtx,
        top_k: config.topK,
        top_p: config.topP,
        repeat_penalty: config.repeatPenalty,
      },
      keep_alive: '5m',
    }, { host: config.host });

    if (onStream) {
      let fullResponse = '';
      const streamPromise = new Promise((resolve, reject) => {
        ollamaPromise.then(async (stream) => {
          for await (const chunk of stream) {
            fullResponse += chunk.response;
            if (onStream) onStream(chunk.response, fullResponse);
          }
          resolve(fullResponse);
        }).catch(reject);
      });

      const response = await Promise.race([streamPromise, timeoutPromise]);
      const duration = Date.now() - startTime;
      console.log(`[ragService] Réponse Ollama streamée en ${duration}ms (${fullResponse.length} caractères)`);
      return fullResponse;
    } else {
      const response = await Promise.race([ollamaPromise, timeoutPromise]);
      const duration = Date.now() - startTime;
      console.log(`[ragService] Réponse Ollama reçue en ${duration}ms (${response.response?.length || 0} caractères)`);
      return response.response;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ragService] Erreur/Timeout Ollama après ${duration}ms:`, error.message);
    return null;
  }
}

// ─── Construire le prompt enrichi pour le LLM ─────────────────────────────
export function buildRagPrompt({
  userMessage,
  unifiedKnowledge = [],
  conversationHistory = [],
  platformInfo = null,
  analysis = null,
}) {
  const config = getConfig();

  // PROMPT SIMPLIFIÉ : Suppression des en-têtes markdown pour éviter le recopiage par llama3.2:1b
  let prompt = `Tu es un expert informatique senior de la DRESI. Tu assistes les utilisateurs de la plateforme ITSM.

Tu es un assistant RAG spécialisé. Tu reçois un contexte issu de la base de connaissances interne. Tu dois produire une réponse qui est UNE SYNTHÈSE de ces connaissances.

Tu n'es pas un moteur de recherche. Ne liste jamais des articles, des documents ou des résultats.
Tu n'es pas un simple lecteur de documents. Tu es un EXPERT qui analyse, croise et synthétise.
Tu ne dis jamais "Voici les articles trouvés", "Consultez cet article", "Selon la base de connaissances".
Tu ne réponds jamais "Aucun article trouvé".

Lis attentivement les connaissances fournies. Fusionne les informations de toutes les sources.
Organise ta réponse de manière logique et pédagogique.
Ajoute des explications, des mises en garde, des astuces d'expert.
Termine par une phrase qui résume et ouvre vers la suite.

À la FIN de ta réponse uniquement, ajoute une section "Sources utilisées :" qui liste les références.

Tu utilises UNIQUEMENT les connaissances fournies ci-dessous.
Tu n'inventes JAMAIS d'information.
Tu peux reformuler, synthétiser, et organiser les informations, mais pas en ajouter.

Le contexte ci-dessous contient TOUTES les informations disponibles.
Ne dis jamais "je n'ai pas trouvé" SAUF si le contexte est réellement vide.
Si le contexte contient un élément pertinent, tu DOIS construire une réponse.

---
`;

  if (platformInfo) {
    prompt += `Contexte de la plateforme :
${typeof platformInfo === 'string' ? platformInfo : JSON.stringify(platformInfo)}

`;
  }

  if (analysis) {
    prompt += `Analyse de la demande :
- Contexte détecté : ${analysis.intent || 'non déterminé'}
- Niveau d'urgence perçu : ${analysis.sentiment?.score > 60 ? 'Élevé' : analysis.sentiment?.score > 30 ? 'Moyen' : 'Normal'}
- Domaine concerné : ${analysis.ticketClassification?.category || 'Non spécifié'}

`;
  }

  if (unifiedKnowledge.length > 0) {
    const budget = calculateAvailableBudget(analysis, conversationHistory);
    const { context, usedTokens, includedResults, excludedResults } = buildContext(unifiedKnowledge, {
      tokenBudget: budget,
      maxResults: config.maxResults,
      includeSources: true,
    });

    prompt += `Connaissances internes (${includedResults.length} éléments, ${usedTokens} tokens) :

${context}
`;

    if (config.debugMode || process.env.RAG_DEBUG_MODE === 'true') {
      console.log(`[ragService] Contexte construit: ${usedTokens}/${budget} tokens utilisés, ${includedResults.length} sources incluses, ${excludedResults.length} exclues`);
      console.log(`[ragService] Sources incluses:`);
      includedResults.forEach((r, i) => {
        console.log(`[ragService]   [${i + 1}] ${r.source_type || r.provider} | ${(r.title || '').substring(0, 60)} | ${(r.content || '').length} chars`);
      });
      if (excludedResults.length > 0) {
        console.log(`[ragService] Sources exclues (budget dépassé):`);
        excludedResults.forEach((r, i) => {
          console.log(`[ragService]   [${i + 1}] ${r.source_type || r.provider} | ${(r.title || '').substring(0, 60)}`);
        });
      }
    }
  } else {
    prompt += `Connaissances internes

Aucune connaissance pertinente n'a été trouvée pour cette question.

`;
  }

  if (conversationHistory.length > 0) {
    prompt += 'Historique de la conversation :\n';
    conversationHistory.slice(-4).forEach(msg => {
      const role = msg.role === 'user' ? 'Utilisateur' : 'Expert DRESI';
      prompt += `${role} : ${msg.content}\n`;
    });
    prompt += '\n';
  }

  prompt += `---

QUESTION DE L'UTILISATEUR
${userMessage}

INSTRUCTION FINALE
Tu es l'expert DRESI. Réponds de manière complète, structurée et professionnelle en français. Synthétise les connaissances internes fournies. Ne te contente pas de les recopier. Ajoute de la valeur par ton expertise. Termine par les sources utilisées.

Si le contexte contient des informations pertinentes, tu DOIS construire une réponse détaillée. Si le contexte est vide ou ne contient aucune information pertinente, tu peux indiquer que tu n'as pas trouvé d'information.`;

  const promptTokens = estimateTokens(prompt);
  console.log(`[ragService] Prompt construit: ${prompt.length} caractères, ~${promptTokens} tokens estimés (max config: ${config.numCtx})`);

  return prompt;
}

// ─── Vérifier si on peut répondre sans LLM ─────────────────────────────────
export function canAnswerWithoutLlm(unifiedKnowledge, config) {
  if (!unifiedKnowledge || unifiedKnowledge.length === 0) return false;
  const bestScore = unifiedKnowledge[0]?.hybrid_score || 0;
  return bestScore >= Math.max(config.confidenceSkipLlm, 0.95);
}

// ─── Construire une réponse directe sans LLM ───────────────────────────────
export function buildDirectResponse(unifiedKnowledge) {
  if (!unifiedKnowledge || unifiedKnowledge.length === 0) {
    return "Je n'ai pas trouvé d'information sur ce sujet dans les connaissances internes de la plateforme. Souhaitez-vous que je crée un ticket pour qu'un expert vous aide ?";
  }

  const bestSources = unifiedKnowledge.slice(0, 3);
  let response = `D'après les informations disponibles dans la base de connaissances interne :\n\n`;

  bestSources.forEach((source, i) => {
    if (source.content) {
      response += source.content.substring(0, 500);
      if (source.content.length > 500) response += '...';
      response += '\n\n';
    }
  });

  response += '---\nSources utilisées :\n';
  unifiedKnowledge.slice(0, 5).forEach(s => {
    const label = s.title || s.source_id || 'Source interne';
    response += `- ${label}\n`;
  });

  return response;
}

// ─── Orchestration complète RAG ───────────────────────────────────────────
export async function processRagQuery({
  userMessage,
  kbArticles = [],
  learnedCases = [],
  conversationHistory = [],
  platformInfo = null,
  analysis = null,
  maxPdfChunks = 3,
  maxKbArticles = 5,
}) {
  const startTime = Date.now();
  const config = getConfig();
  const pipelineMetrics = { steps: {} };

  const cacheKey = `${userMessage.toLowerCase().trim()}-${maxKbArticles}`;
  const cachedResponse = responseCache.get(cacheKey);
  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
    if (config.debugMode) {
      console.log(`[ragService] ✅ Cache hit! Réponse récupérée depuis le cache`);
    }
    return { ...cachedResponse.response, fromCache: true };
  }

  const keywords = extractKeywords(userMessage);

  if (config.debugMode) {
    console.log('\n' + '═'.repeat(80));
    console.log('QUESTION:', userMessage);
    console.log('MOTS-CLÉS EXTRAITS:', keywords.join(', '));
    console.log('═'.repeat(80));
  }

  const tSearch = Date.now();
  const unifiedKnowledge = await searchUnifiedKnowledge(userMessage, maxKbArticles);
  pipelineMetrics.steps.search = Date.now() - tSearch;
  pipelineMetrics.steps.searchDetails = {
    totalResults: unifiedKnowledge.length,
  };

  if (unifiedKnowledge.length === 0) {
    console.log(`[ragService] ❌ AUCUN CONTEXTE PERTINENT`);
    console.log(`[ragService] → Pas d'appel à Ollama`);
    console.log('═'.repeat(80) + '\n');

    return {
      response: "Je n'ai trouvé aucune information concernant votre question dans la base de connaissances interne. Souhaitez-vous que je crée un ticket pour que nos experts puissent vous aider ?",
      pdfChunks: [],
      kbArticlesUsed: 0,
      promptLength: 0,
      duration: Date.now() - startTime,
      noContext: true,
      pipelineMetrics,
    };
  }

  if (canAnswerWithoutLlm(unifiedKnowledge, config)) {
    const directResponse = buildDirectResponse(unifiedKnowledge);
    console.log(`[ragService] ✅ Réponse directe sans LLM (score: ${(unifiedKnowledge[0].hybrid_score * 100).toFixed(0)}%)`);

    const result = {
      response: directResponse,
      pdfChunks: unifiedKnowledge.filter(k => k.source_type === 'internal_document'),
      kbArticlesUsed: unifiedKnowledge.filter(k => k.source_type === 'knowledge_base').length,
      promptLength: 0,
      duration: Date.now() - startTime,
      noContext: false,
      fromDirectResponse: true,
      pipelineMetrics,
    };

    responseCache.set(cacheKey, { response: result, timestamp: Date.now() });

    return result;
  }

  const tPrompt = Date.now();
  const prompt = buildRagPrompt({
    userMessage,
    unifiedKnowledge,
    conversationHistory,
    platformInfo,
    analysis,
  });
  pipelineMetrics.steps.promptBuilding = Date.now() - tPrompt;
  pipelineMetrics.steps.promptDetails = {
    promptLength: prompt.length,
    promptTokens: estimateTokens(prompt),
  };

  console.log(`[ragService] ✅ Contexte pertinent trouvé (${unifiedKnowledge.length} connaissances), appel à Ollama...`);
  console.log('═'.repeat(80) + '\n');

  const tLlm = Date.now();
  const llmResponse = await callOllama(prompt);
  pipelineMetrics.steps.llmCall = Date.now() - tLlm;
  pipelineMetrics.steps.llmDetails = {
    responseLength: llmResponse?.length || 0,
    responseTokens: estimateTokens(llmResponse || ''),
  };

  const totalDuration = Date.now() - startTime;
  pipelineMetrics.total = totalDuration;

  const isCacheHit = !!cachedResponse;
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`📊 PERFORMANCE RAG - "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`);
  console.log(`⏱️  Temps total: ${totalDuration}ms`);
  console.log(`  ├─ Recherche KB/PDF/Tickets: ${pipelineMetrics.steps.search}ms`);
  console.log(`  ├─ Construction contexte: ${pipelineMetrics.steps.promptBuilding}ms`);
  console.log(`  ├─ Attente + génération Ollama: ${pipelineMetrics.steps.llmCall}ms`);
  console.log(`  └─ Total: ${totalDuration}ms`);
  console.log(`📈 Métriques:`);
  console.log(`  ├─ Sources trouvées: ${unifiedKnowledge.length}`);
  console.log(`  ├─ Contexte: ${pipelineMetrics.steps.promptDetails?.promptTokens || 0} tokens`);
  console.log(`  ├─ Réponse: ${pipelineMetrics.steps.llmDetails?.responseTokens || 0} tokens`);
  console.log(`  └─ Cache: ${isCacheHit ? 'HIT ✅' : 'MISS ❌'}`);
  console.log('═'.repeat(80) + '\n');

  const finalResponse = llmResponse || "Je n'ai pas trouvé d'information sur ce sujet dans les connaissances internes de la plateforme. Souhaitez-vous que je crée un ticket pour qu'un expert vous aide ?";

  if (!llmResponse) {
    console.error(`[ragService] ❌ Ollama a retourné null - fallback appliqué`);
  }

  const result = {
    response: finalResponse,
    pdfChunks: unifiedKnowledge.filter(k => k.source_type === 'internal_document'),
    kbArticlesUsed: unifiedKnowledge.filter(k => k.source_type === 'knowledge_base').length,
    promptLength: prompt.length,
    duration: totalDuration,
    noContext: false,
    fromDirectResponse: false,
    llmFailed: !llmResponse,
    pipelineMetrics,
  };

  responseCache.set(cacheKey, {
    response: result,
    timestamp: Date.now()
  });

  return result;
}

// ─── Recherche dans les cas appris (unifiée) ──────────────────────────────
export async function searchLearnedCases(input, limit = 3) {
  try {
    const pool = (await import('../db.js')).default;
    let keywords = input;
    if (typeof input === 'string') {
      keywords = extractKeywords(input);
    }

    if (!keywords || keywords.length === 0) return [];

    const result = await pool.query(
      `SELECT id, problem_summary, solution_text, hit_count 
       FROM chatbot_learned_cases 
       WHERE problem_keywords && $1 
       ORDER BY hit_count DESC, confidence_score DESC 
       LIMIT $2`,
      [keywords, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('[ragService] Erreur recherche cas appris:', error.message);
    return [];
  }
}

// ─── Synchronisation en masse des cas appris (unifiée) ────────────────────
export async function syncAll() {
  let syncedTickets = 0;
  let syncedArticles = 0;

  try {
    const pool = (await import('../db.js')).default;
    const ticketsResult = await pool.query("SELECT id FROM tickets WHERE status = 'Résolu'");
    for (const ticket of ticketsResult.rows) {
      await learnFromTicket(ticket.id);
      syncedTickets++;
    }
    console.log(`[ragService] Sync terminée: ${syncedTickets} tickets appris`);
  } catch (error) {
    console.error('[ragService] Erreur sync tickets:', error.message);
  }

  try {
    const pool = (await import('../db.js')).default;
    const articlesResult = await pool.query('SELECT id FROM knowledge_articles');
    for (const article of articlesResult.rows) {
      await learnFromArticle(article.id);
      syncedArticles++;
    }
    console.log(`[ragService] Sync terminée: ${syncedArticles} articles appris`);
  } catch (error) {
    console.error('[ragService] Erreur sync articles:', error.message);
  }

  // Invalider le cache des fréquences de mots-clés, car de nouveaux learned_cases ont été ajoutés
  try {
    const { invalidateCache } = await import('./keywordFrequencyCache.js');
    invalidateCache();
  } catch (e) {}

  return { synced_tickets: syncedTickets, synced_articles: syncedArticles };
}

// ─── Recherche dans la base de connaissances (importée) ───────────────────
async function searchKnowledgeBase(query, options = {}) {
  try {
    const { searchKnowledgeBase: searchKB } = await import('./knowledgeBaseSearch.js');
    return await searchKB(query, options);
  } catch (error) {
    console.error('[ragService] Erreur recherche KB:', error.message);
    return [];
  }
}

// ─── Extraction de mots-clés ───────────────────────────────────────────────
function extractKeywords(text) {
  const stopWords = ['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car',
                     'comment', 'pourquoi', 'quand', 'où', 'qui', 'que', 'quoi', 'dont', 'quoi',
                     'est', 'sont', 'a', 'ont', 'être', 'avoir', 'faire', 'peut', 'doit',
                     'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
                     'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                     'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'];

  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));

  return [...new Set(words)];
}

// ─── Apprentissage à partir d'un ticket résolu (cas appris) ───────────────
export async function learnFromTicket(ticketId) {
  try {
    const pool = (await import('../db.js')).default;
    const ticketResult = await pool.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    if (ticketResult.rows.length === 0) return;
    const ticket = ticketResult.rows[0];

    const commentsResult = await pool.query(
      'SELECT content FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at',
      [ticketId]
    );
    const comments = commentsResult.rows.map(c => c.content).join(' ');
    const keywords = extractKeywords(ticket.title + ' ' + ticket.description + ' ' + comments);
    const problemSummary = ticket.title;
    const solutionText = comments || 'Ticket résolu';

    await pool.query(
      `INSERT INTO chatbot_learned_cases 
       (problem_keywords, problem_summary, solution_text, source_type, source_id)
       VALUES ($1, $2, $3, 'ticket', $4)
       ON CONFLICT DO NOTHING`,
      [keywords, problemSummary, solutionText, ticketId]
    );
    console.log(`[ragService] Cas appris depuis le ticket #${ticketId}`);
  } catch (error) {
    console.error('[ragService] Erreur apprentissage ticket:', error.message);
  }
}

// ─── Apprentissage à partir d'un article KB (cas appris) ──────────────────
export async function learnFromArticle(articleId) {
  try {
    const pool = (await import('../db.js')).default;
    const result = await pool.query('SELECT * FROM knowledge_articles WHERE id = $1', [articleId]);
    if (result.rows.length === 0) return;
    const article = result.rows[0];

    const keywords = extractKeywords(article.title + ' ' + article.summary + ' ' + article.content);

    await pool.query(
      `INSERT INTO chatbot_learned_cases 
       (problem_keywords, problem_summary, solution_text, source_type, source_id)
       VALUES ($1, $2, $3, 'article', $4)
       ON CONFLICT DO NOTHING`,
      [keywords, article.title, article.content, articleId]
    );
    console.log(`[ragService] Cas appris depuis l'article KB #${articleId}`);
  } catch (error) {
    console.error('[ragService] Erreur apprentissage article:', error.message);
  }
}

// ─── Routeur d'intention ───────────────────────────────────────────────────
export function routeIntent(userMessage, hasKnowledgeBaseResults) {
  const documentKeywords = ['comment', 'quoi', 'que', 'quel', 'quelle', 'où', 'quand', 'pourquoi', 'procédure', 'étapes', 'étant'];
  const analysisKeywords = ['analyse', 'priorité', 'technicien', 'risque', 'prédiction', 'sentiment', 'catégorie'];

  const messageLower = userMessage.toLowerCase();

  const isDocumentary = documentKeywords.some(keyword => messageLower.includes(keyword));
  const isAnalysis = analysisKeywords.some(keyword => messageLower.includes(keyword));

  if (isDocumentary && !isAnalysis) {
    return { type: 'documentary', pipeline: 'rag_only', description: 'Question documentaire - Pipeline RAG uniquement' };
  } else if (isAnalysis && !isDocumentary) {
    return { type: 'analysis', pipeline: 'intelligent_only', description: 'Analyse métier - Pipeline intelligent uniquement' };
  } else if (isDocumentary && isAnalysis) {
    return { type: 'mixed', pipeline: 'combined', description: 'Demande mixte - Combinaison des deux pipelines' };
  } else {
    return {
      type: 'auto',
      pipeline: hasKnowledgeBaseResults ? 'rag_primary' : 'intelligent_primary',
      description: hasKnowledgeBaseResults
        ? 'Connaissances disponibles - Pipeline RAG prioritaire'
        : 'Pas de connaissances - Pipeline intelligent prioritaire'
    };
  }
}

export default {
  searchDocumentChunks,
  searchUnifiedKnowledge,
  callOllama,
  buildRagPrompt,
  processRagQuery,
  routeIntent,
  canAnswerWithoutLlm,
  buildDirectResponse,
};