import pool from '../../db.js';
import dotenv from 'dotenv';
import { INTENTS, normalizeText, classifyCategoryByKeywords, extractKeywords } from '../../utils/nlpUtils.js';
import { detectIntentWithConfidence } from '../intentService.js';
import { searchKnowledgeBase } from '../knowledgeBaseSearch.js';
import ragService, { learnFromTicket as learnFromTicketShared, learnFromArticle as learnFromArticleShared } from '../ragService.js';
import { addHistoryMessage, getHistory, loadConversationState } from '../conversationService.js';
import { analyzeConversationIntent } from '../../utils/nlpUtils.js';
dotenv.config();

// Les valeurs sont lues dynamiquement depuis les paramètres
// via `getSettings()` au moment de l'appel pour permettre
// la reconfiguration sans redémarrer le serveur.

const getOrCreateSession = async (sessionKey, userId = null) => {
  let result = await pool.query('SELECT * FROM chatbot_sessions WHERE session_key = $1', [sessionKey]);
  if (result.rows.length > 0) {
    await pool.query('UPDATE chatbot_sessions SET last_active = NOW() WHERE id = $1', [result.rows[0].id]);
    return result.rows[0];
  }
  result = await pool.query(
    'INSERT INTO chatbot_sessions (user_id, session_key) VALUES ($1, $2) RETURNING *',
    [userId, sessionKey]
  );
  return result.rows[0];
};

const saveMessage = async (sessionId, role, content, intent = null, confidence = null) => {
  await pool.query(
    'INSERT INTO chatbot_messages (session_id, role, content, intent, confidence) VALUES ($1, $2, $3, $4, $5)',
    [sessionId, role, content, intent, confidence]
  );
};

const searchMemory = async (keywords) => {
  // Délègue à la fonction partagée dans ragService.js
  const { searchLearnedCases } = await import('../ragService.js');
  return searchLearnedCases(keywords);
};

const searchKB = async (query) => {
  return await searchKnowledgeBase(query, { language: 'fr', limit: 3 });
};

const getSessionMessages = async (sessionId) => {
  const result = await pool.query(
    `SELECT role, content FROM chatbot_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT 10`,
    [sessionId]
  );
  return result.rows.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));
};

const learnFromTicket = async (ticketId) => {
  // Délègue à la fonction partagée dans ragService.js
  return learnFromTicketShared(ticketId);
};

const learnFromArticle = async (articleId) => {
  // Délègue à la fonction partagée dans ragService.js
  return learnFromArticleShared(articleId);
};

const processMessage = async (sessionKey, userId, userMessage) => {
  const session = await getOrCreateSession(sessionKey, userId);
  const { intent, confidence, category } = detectIntentWithConfidence(userMessage);
  const keywords = extractKeywords(userMessage);
  
  // Analyse complète d'intention avec contexte et routage (unifiée)
  const intentAnalysis = await analyzeConversationIntent(userMessage, sessionKey, false, loadConversationState);

  await saveMessage(session.id, 'user', userMessage, intent, confidence);

  let answer = '';
  const sources = [];
  const memoryCases = await searchMemory(keywords);
  const kbArticles = await searchKB(userMessage);
  
  // Réutiliser le contexte de conversation si disponible (pour les questions complémentaires)
  let conversationHistory = [];
  const cachedState = loadConversationState(sessionKey);
  
  if (cachedState && cachedState.history && cachedState.history.length > 0) {
    // Vérifier si c'est une question complémentaire (commence par "et", "aussi", "sinon", etc.)
    const isFollowUp = /^(et|aussi|sinon|puis|en plus|par ailleurs|d'ailleurs|autrement)/i.test(userMessage.trim());
    if (isFollowUp) {
      conversationHistory = cachedState.history;
      console.log(`[chatbotBrain] ♻️  Contexte réutilisé depuis conversationService (${conversationHistory.length} messages)`);
    }
  }
  
  // Compléter avec l'historique de la BDD si nécessaire
  if (conversationHistory.length === 0) {
    conversationHistory = await getSessionMessages(session.id);
  }

  // Recherche unifiée dans la base de connaissances
  const unifiedKnowledge = await ragService.searchUnifiedKnowledge(userMessage, 5);
  console.log(`[chatbotBrain] Connaissances unifiées trouvées: ${unifiedKnowledge.length}`);

  // Routage pipeline (RAG vs Smart) — déjà inclus dans intentAnalysis.routing
  console.log(`[chatbotBrain] Routeur d'intention: ${intentAnalysis.routing.description}`);

  const platformInfo = `
  - Pour créer un ticket : clique sur "Tickets" → "Nouveau ticket"
  - Pour consulter tes tickets : clique sur "Tickets" → "Mes tickets"
  - Pour voir tes équipements : clique sur "Équipements"
  - Pour accéder à la base de connaissances : clique sur "Base de connaissances"
  `;

  let llmResponse = null;
  
  // Vérifier s'il y a du contexte pertinent et si le routeur demande du RAG
  if (unifiedKnowledge.length > 0 && (intentAnalysis.routing.pipeline === 'rag_only' || intentAnalysis.routing.pipeline === 'rag_primary' || intentAnalysis.routing.pipeline === 'combined')) {
    const prompt = ragService.buildRagPrompt({
      userMessage,
      unifiedKnowledge,
      conversationHistory,
      platformInfo,
      analysis: null,
    });

    llmResponse = await ragService.callOllama(prompt);
  }

  if (llmResponse) {
    answer = llmResponse;
  } else {
    // Fallback si pas de contexte pertinent ou erreur LLM
    if (memoryCases.length > 0) {
      await pool.query('UPDATE chatbot_learned_cases SET hit_count = hit_count + 1 WHERE id = $1', [memoryCases[0].id]);
      answer = `J'ai trouvé une solution similaire :\n\n${memoryCases[0].solution_text}`;
    } else if (intent === INTENTS.GREETING) {
      answer = 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?';
    } else if (intent === INTENTS.TICKET_CREATE) {
      answer = `Je vais créer un ticket pour vous. Catégorie détectée : ${category}. Voulez-vous continuer ?`;
    } else if (intent === INTENTS.KB_SEARCH) {
      if (kbArticles.length > 0) {
        answer = `Voici les articles trouvés :\n${kbArticles.map(a => `- ${a.title}`).join('\n')}`;
      } else {
        answer = 'Je n\'ai trouvé aucune information concernant votre question dans la base de connaissances interne. Souhaitez-vous que je crée un ticket pour que nos experts puissent vous aider ?';
      }
    } else {
      answer = 'Je n\'ai pas trouvé d\'information pertinente dans la base de connaissances interne. Souhaitez-vous que je crée un ticket pour vous aider ?';
    }
  }

  // Ajoute les articles KB comme sources (pas de documents PDF)
  if (kbArticles.length > 0) {
    kbArticles.forEach(article => {
      sources.push({
        id: article.id,
        title: article.title,
        summary: article.summary
      });
    });
  }

  await saveMessage(session.id, 'bot', answer, intent, confidence);
  await pool.query(
    'INSERT INTO chatbot_logs (session_key, intent, confidence, query, response) VALUES ($1, $2, $3, $4, $5)',
    [sessionKey, intent, confidence, userMessage, answer]
  );

  // Mettre à jour le cache de contexte via conversationService
  addHistoryMessage(sessionKey, 'user', userMessage);
  addHistoryMessage(sessionKey, 'assistant', answer);

  return {
    answer,
    sources,
    hasResults: sources.length > 0
  };
};

const syncAll = async () => {
  // Délègue à la fonction partagée dans ragService.js
  const { syncAll: syncAllShared } = await import('../ragService.js');
  return syncAllShared();
};

export default {
  syncAll,
  getOrCreateSession
};
