// backend/src/controllers/chatbotController.js
import { searchKnowledgeForChat } from '../services/autoTicketing/suggestionEngine.js';
import { t } from '../utils/i18n.js';

function buildResponse(req, articles) {
  if (articles.length === 0) {
    return {
      answer: t(req, 'chatbot_no_results'),
      sources: [],
    };
  }

  const best = articles[0];

  const sentences = best.content
    .replace(/#+\s*/g, '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .slice(0, 4)
    .join(' ');

  const answer = sentences || best.summary;

  return {
    answer,
    sources: articles.map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      category: a.category,
      relevance: parseFloat(a.relevance).toFixed(3),
    })),
  };
}

export async function askChatbot(req, res) {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: t(req, 'chatbot_empty_message') });
  }

  if (message.trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: t(req, 'chatbot_too_short'),
    });
  }

  try {
    const articles = await searchKnowledgeForChat(message.trim(), 3);
    const { answer, sources } = buildResponse(req, articles);

    return res.json({
      success: true,
      answer,
      sources,
      hasResults: sources.length > 0,
    });
  } catch (err) {
    console.error('[chatbot]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}
