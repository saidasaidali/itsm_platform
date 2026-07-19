import chatbotBrain from '../services/chatbot/chatbotBrain.js';
import smartAssistantService from '../services/smartAssistantService.js';
import pool from '../db.js';
import whisperService from '../services/whisperService.js';
import asyncHandler from '../middlewares/asyncHandler.js';

export const voiceMessage = asyncHandler(async (req, res) => {
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

    // Envoyer le texte transcrit à l'orchestrateur fusionné Smart Assistant
    const result = await smartAssistantService.processSmartMessage(transcript, userId, sessionKey);

    res.json({
      success: true,
      transcript: transcript,
      answer: result.response,
      sources: result.sources || [],
      hasResults: (result.sources || []).length > 0
    });
});

export const askChatbot = asyncHandler(async (req, res) => {
  const { message, session_key } = req.body;
  const userId = req.user?.id;
  const sessionKey = session_key || `session-${Date.now()}`;
  
  // Appelle l'orchestrateur fusionné Smart Assistant
  const result = await smartAssistantService.processSmartMessage(message, userId, sessionKey);
  
  // Mapping vers le format legacy chatbot pour compatibilité
  res.json({
    answer: result.response,
    sources: result.sources || [],
    hasResults: (result.sources || []).length > 0
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const { session_key, message } = req.body;
  const userId = req.user?.id;
  
  // Appelle l'orchestrateur fusionné Smart Assistant
  const result = await smartAssistantService.processSmartMessage(message, userId, session_key);
  
  // Mapping vers le format legacy chatbot pour compatibilité
  res.json({
    success: true,
    data: {
      answer: result.response,
      sources: result.sources || [],
      hasResults: (result.sources || []).length > 0
    }
  });
});

export const syncAll = asyncHandler(async (req, res) => {
  const result = await chatbotBrain.syncAll();
  res.json({ success: true, data: result });
});

export const getTopCases = asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM chatbot_top_cases LIMIT 10');
  res.json({ success: true, data: result.rows });
});

export const getSessionHistory = asyncHandler(async (req, res) => {
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
});
