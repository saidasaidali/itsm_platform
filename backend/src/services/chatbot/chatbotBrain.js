import pool from '../../db.js';
import ollama from 'ollama';
import dotenv from 'dotenv';
import { INTENTS, normalizeText, classifyCategoryByKeywords, extractKeywords } from '../../utils/nlpUtils.js';
import { detectIntentWithConfidence } from '../intentService.js';
import { searchKnowledgeBase } from '../knowledgeBaseSearch.js';
dotenv.config();

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

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
  if (!keywords || keywords.length === 0) return [];
  const result = await pool.query(
    `SELECT id, problem_summary, solution_text, hit_count 
     FROM chatbot_learned_cases 
     WHERE problem_keywords && $1 
     ORDER BY hit_count DESC, confidence_score DESC 
     LIMIT 3`,
    [keywords]
  );
  return result.rows;
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

const buildPrompt = (userMessage, memoryCases, kbArticles, platformInfo, conversationHistory) => {
  let prompt = `Tu es un assistant ITSM (IT Service Management) pour la plateforme ITSM interne. Tu es professionnel, poli, et tu parles français.
Règles importantes :
- Tu dois guider les utilisateurs sur la plateforme ITSM.
- Tu utilises les informations de la base de connaissances et des cas appris pour répondre.
- Tu ne dois jamais inventer d'informations. Si tu ne sais pas, dis-le et propose de créer un ticket.
- Tu es local, 100% interne, aucune donnée ne sort de l'entreprise.

Informations de contexte :
`;

  if (platformInfo) {
    prompt += `\nGuide de la plateforme : ${platformInfo}\n`;
  }

  if (memoryCases.length > 0) {
    prompt += '\nCas similaires déjà résolus :\n';
    memoryCases.forEach((c, i) => {
      prompt += `${i + 1}. Problème : ${c.problem_summary}\n   Solution : ${c.solution_text}\n`;
    });
  }

  if (kbArticles.length > 0) {
    prompt += '\nArticles de la base de connaissances :\n';
    kbArticles.forEach((a, i) => {
      prompt += `${i + 1}. Titre : ${a.title}\n   Résumé : ${a.summary}\n   Contenu : ${a.content?.substring(0, 200)}...\n`;
    });
  }

  if (conversationHistory.length > 0) {
    prompt += '\nHistorique de la conversation :\n';
    conversationHistory.forEach(msg => {
      prompt += `${msg.role === 'user' ? 'Utilisateur' : 'Assistant'} : ${msg.content}\n`;
    });
  }

  prompt += `\nQuestion de l'utilisateur : ${userMessage}\n\nRéponds en français de manière claire et concise.`;
  return prompt;
};

const callLLM = async (prompt) => {
  try {
    const response = await ollama.generate({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 512
      }
    }, { host: OLLAMA_URL });
    return response.response;
  } catch (error) {
    console.error('Erreur lors de l\'appel à Ollama :', error.message);
    return null;
  }
};

const learnFromTicket = async (ticketId) => {
  const ticketResult = await pool.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
  if (ticketResult.rows.length === 0) return;
  const ticket = ticketResult.rows[0];
  
  const commentsResult = await pool.query('SELECT content FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at', [ticketId]);
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
};

const learnFromArticle = async (articleId) => {
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
};

const processMessage = async (sessionKey, userId, userMessage) => {
  const session = await getOrCreateSession(sessionKey, userId);
  const { intent, confidence, category } = detectIntentWithConfidence(userMessage);
  const keywords = extractKeywords(userMessage);

  await saveMessage(session.id, 'user', userMessage, intent, confidence);

  let answer = '';
  const sources = [];
  const memoryCases = await searchMemory(keywords);
  const kbArticles = await searchKB(userMessage);
  const conversationHistory = await getSessionMessages(session.id);

  const platformInfo = `
  - Pour créer un ticket : clique sur "Tickets" → "Nouveau ticket"
  - Pour consulter tes tickets : clique sur "Tickets" → "Mes tickets"
  - Pour voir tes équipements : clique sur "Équipements"
  - Pour accéder à la base de connaissances : clique sur "Base de connaissances"
  `;

  const llmResponse = await callLLM(buildPrompt(userMessage, memoryCases, kbArticles, platformInfo, conversationHistory));

  if (llmResponse) {
    answer = llmResponse;
  } else {
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
        answer = 'Aucun article trouvé. Voulez-vous créer un ticket ?';
      }
    } else {
      answer = 'Je vais rechercher des informations pour vous.';
      if (kbArticles.length > 0) {
        answer += `\n\nVoici des articles qui pourraient vous aider :\n${kbArticles.map(a => `- ${a.title}`).join('\n')}`;
      }
    }
  }

  // Ajoute les articles KB comme sources
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

  return {
    answer,
    sources,
    hasResults: sources.length > 0
  };
};

const syncAll = async () => {
  const ticketsResult = await pool.query("SELECT id FROM tickets WHERE status = 'Résolu'");
  for (const ticket of ticketsResult.rows) {
    await learnFromTicket(ticket.id);
  }
  
  const articlesResult = await pool.query('SELECT id FROM knowledge_articles');
  for (const article of articlesResult.rows) {
    await learnFromArticle(article.id);
  }
  
  return { synced_tickets: ticketsResult.rows.length, synced_articles: articlesResult.rows.length };
};

export default {
  processMessage,
  learnFromTicket,
  learnFromArticle,
  syncAll,
  getOrCreateSession
};
