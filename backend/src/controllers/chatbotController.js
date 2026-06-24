import chatbotBrain from '../services/chatbot/chatbotBrain.js';
import pool from '../db.js';

export const askChatbot = async (req, res) => {
  try {
    const { message, session_key } = req.body;
    const userId = req.user?.id;
    const sessionKey = session_key || `session-${Date.now()}`;
    const response = await chatbotBrain.processMessage(sessionKey, userId, message);
    res.json(response);
  } catch (error) {
    console.error('[Chatbot] Erreur askChatbot:', error);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { session_key, message } = req.body;
    const userId = req.user?.id;
    const response = await chatbotBrain.processMessage(session_key, userId, message);
    res.json({ success: true, data: response });
  } catch (error) {
    console.error('[Chatbot] Erreur sendMessage:', error);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
};

export const syncAll = async (req, res) => {
  try {
    const result = await chatbotBrain.syncAll();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[Chatbot] Erreur syncAll:', error);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
};

export const getTopCases = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM chatbot_top_cases LIMIT 10');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[Chatbot] Erreur getTopCases:', error);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
};

export const getSessionHistory = async (req, res) => {
  try {
    const { session_key } = req.params;
    const sessionResult = await pool.query('SELECT id FROM chatbot_sessions WHERE session_key = $1', [session_key]);
    if (sessionResult.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const messagesResult = await pool.query(
      'SELECT * FROM chatbot_messages WHERE session_id = $1 ORDER BY created_at',
      [sessionResult.rows[0].id]
    );
    res.json({ success: true, data: messagesResult.rows });
  } catch (error) {
    console.error('[Chatbot] Erreur getSessionHistory:', error);
    res.status(500).json({ success: false, message: 'Erreur interne' });
  }
};
