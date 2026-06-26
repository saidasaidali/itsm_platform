import chatbotBrain from '../services/chatbot/chatbotBrain.js';
import pool from '../db.js';
import whisperService from '../services/whisperService.js';

export const voiceMessage = async (req, res) => {
  try {
    console.log('[Voice] Reçu requête voice');
    console.log('[Voice] Headers:', req.headers);
    console.log('[Voice] Body keys:', Object.keys(req.body));
    console.log('[Voice] File present:', !!req.file);
    if (req.file) {
      console.log('[Voice] File info:', {
        fieldname: req.file.fieldname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aucun fichier audio fourni. Vérifiez que le champ "audio" est présent dans le FormData.' 
      });
    }

    const userId = req.user?.id;
    const sessionKey = req.body.session_key || `session-${Date.now()}`;

    console.log('[Voice] Session key:', sessionKey);
    console.log('[Voice] User ID:', userId);

    // Transcrire l'audio en texte
    let transcript;
    try {
      transcript = await whisperService.transcribeWithFallback(req.file.buffer, 'fr');
    } catch (whisperError) {
      console.error('[Voice] Erreur Whisper:', whisperError.message);
      return res.status(503).json({ 
        success: false, 
        message: 'La fonctionnalité vocale n\'est pas disponible. Whisper.cpp n\'est pas installé sur le serveur. Veuillez utiliser la saisie texte.',
        service_unavailable: true
      });
    }
    
    if (!transcript || transcript.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Transcription vide ou aucune parole détectée' });
    }

    // Envoyer le texte transcrit au pipeline du chatbot
    const response = await chatbotBrain.processMessage(sessionKey, userId, transcript);

    res.json({
      success: true,
      transcript: transcript,
      answer: response.answer,
      sources: response.sources,
      hasResults: response.hasResults
    });
  } catch (error) {
    console.error('[Chatbot] Erreur voiceMessage:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du traitement vocal' });
  }
};

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
