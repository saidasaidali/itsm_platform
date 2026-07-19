// backend/src/controllers/smartAssistantController.js
// Contrôleur pour le Smart IT Assistant — AVEC LOGS DE DIAGNOSTIC COMPLETS
import smartAssistantService from '../services/smartAssistantService.js';
import pool from '../db.js';
import asyncHandler from '../middlewares/asyncHandler.js';

/**
 * Traiter un message avec le Smart Assistant
 * POST /api/smart-assistant/chat
 */
export const processSmartMessage = asyncHandler(async (req, res) => {
    const { message, session_key } = req.body;
    const userId = req.user?.id;

    if (!message || message.trim().length === 0) {
      console.log(`[DIAG] ⛔ Message vide rejeté`);
      return res.status(400).json({
        success: false,
        message: 'Le message ne peut pas être vide'
      });
    }

    const sessionKey = session_key || `session-${Date.now()}`;

    console.log(`\n${'🔍'.repeat(40)}`);
    console.log(`[DIAG] ⏺ ÉTAPE 0: RÉCEPTION REQUÊTE`);
    console.log(`[DIAG]    Message: "${message.substring(0, 80)}..."`);
    console.log(`[DIAG]    UserID: ${userId}`);
    console.log(`[DIAG]    Session: ${sessionKey}`);
    console.log(`[DIAG]    Timestamp: ${new Date().toISOString()}`);
    console.log(`${'🔍'.repeat(40)}\n`);

    // Traiter le message avec le pipeline intelligent
    console.log(`[DIAG] ⏺ ÉTAPE 1: APPEL processSmartMessage()`);
    const t0 = Date.now();
    const result = await smartAssistantService.processSmartMessage(message, userId, sessionKey);
    const serviceDuration = Date.now() - t0;
    console.log(`[DIAG] ⏺ ÉTAPE 2: RETOUR processSmartMessage()`);
    console.log(`[DIAG]    Durée service: ${serviceDuration}ms`);

    // VÉRIFICATION CRITIQUE : le format de la réponse
    console.log(`\n[DIAG] 📦 ANALYSE DE LA RÉPONSE:`);
    console.log(`[DIAG]    Type de result: ${typeof result}`);
    console.log(`[DIAG]    result === null: ${result === null}`);
    console.log(`[DIAG]    result === undefined: ${result === undefined}`);
    console.log(`[DIAG]    Clés de result: ${Object.keys(result || {}).join(', ')}`);
    console.log(`[DIAG]    result.response: ${typeof result?.response}`);
    console.log(`[DIAG]    result.response length: ${result?.response?.length || 0}`);
    console.log(`[DIAG]    result.response === "": ${result?.response === ''}`);
    console.log(`[DIAG]    result.response === null: ${result?.response === null}`);
    console.log(`[DIAG]    result.response === undefined: ${result?.response === undefined}`);
    console.log(`[DIAG]    result.analysis: ${typeof result?.analysis}`);
    console.log(`[DIAG]    result.metadata: ${typeof result?.metadata}`);
    console.log(`[DIAG]    result.metadata?.processingTime: ${result?.metadata?.processingTime}`);

    // PROTECTION : garantir que response n'est jamais null/undefined
    if (!result || !result.response || result.response === null || result.response === undefined || result.response === '') {
      console.error(`[DIAG] ❌ CRITIQUE: result.response est invalide!`);
      console.error(`[DIAG]    result: ${JSON.stringify(result, null, 2).substring(0, 500)}`);
      
      // Forcer une réponse de fallback
      result.response = "Je n'ai pas trouvé d'information sur ce sujet dans les connaissances internes de la plateforme. Souhaitez-vous que je crée un ticket pour qu'un expert vous aide ?";
      if (!result.analysis) result.analysis = { intent: 'general', sentiment: { sentiment: 'neutre', score: 0, emotions: [], intensity: 0, isCritical: false } };
      if (!result.metadata) result.metadata = { processingTime: serviceDuration };
      if (!result.sources) result.sources = [];
    }

    // Sauvegarder le log en base de données (avec protection anti-plantage)
    try {
      const analysis = result.analysis || {};
      const sentiment = analysis.sentiment || { sentiment: 'neutre', score: 0, emotions: [], intensity: 0, isCritical: false };
      const classification = analysis.classification || {};
      const metadata = result.metadata || {};
      
      await pool.query(
        `INSERT INTO smart_assistant_logs 
         (user_id, session_key, user_message, intent, confidence,
          sentiment, sentiment_score, sentiment_emotions, sentiment_intensity, sentiment_is_critical,
          entities, asset_id, asset_confidence, asset_identification_method,
          ticket_category, ticket_priority, ticket_classification_confidence,
          ml_risk_score, ml_risk_level,
          recommended_technician_id, technician_score,
          is_security_incident, security_incident_type, security_incident_severity,
          ticket_created_id, processing_time_ms, bot_response, sources)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`,
        [
          userId,
          sessionKey,
          message,
          analysis.intent || 'general',
          0.8,
          sentiment.sentiment || 'neutre',
          sentiment.score || 0,
          JSON.stringify(sentiment.emotions || []),
          sentiment.intensity || 0,
          sentiment.isCritical || false,
          '{}',
          analysis.asset?.id || null,
          analysis.asset ? 0.8 : 0,
          analysis.asset ? 'identified' : null,
          classification.category || null,
          classification.priority || null,
          classification.confidence || null,
          analysis.mlPrediction?.risk_score || null,
          analysis.mlPrediction?.risk_level || null,
          analysis.technician?.id || null,
          analysis.technician?.score || null,
          analysis.securityIncident?.isSecurityIncident || false,
          analysis.securityIncident?.type || null,
          analysis.securityIncident?.severity || null,
          analysis.ticketCreated?.id || null,
          metadata.processingTime || serviceDuration,
          result.response,
          JSON.stringify(result.sources || [])
        ]
      );
      console.log(`[DIAG] ✅ Log sauvegardé en base`);
    } catch (logError) {
      console.error(`[DIAG] ⚠️ Erreur sauvegarde log (non bloquante): ${logError.message}`);
    }

    // Envoyer la réponse au frontend
    console.log(`\n[DIAG] ⏺ ÉTAPE FINALE: ENVOI RÉPONSE FRONTEND`);
    console.log(`[DIAG]    response length: ${result.response.length} caractères`);
    console.log(`[DIAG]    response preview: "${result.response.substring(0, 100)}..."`);
    console.log(`[DIAG]    Durée totale: ${Date.now() - t0}ms`);
    console.log(`${'✅'.repeat(40)}\n`);

    res.json({
      success: true,
      data: result
    });
});

/**
 * Obtenir les statistiques du Smart Assistant
 * GET /api/smart-assistant/stats
 */
export const getStats = asyncHandler(async (req, res) => {
    const { days = 7 } = req.query;
    
    const { rows } = await pool.query(
      `SELECT * FROM smart_assistant_stats 
       WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY date DESC`
    );

    res.json({
      success: true,
      data: rows
    });
});

/**
 * Obtenir les incidents de sécurité actifs
 * GET /api/smart-assistant/security-incidents
 */
export const getSecurityIncidents = asyncHandler(async (req, res) => {
    const { status = 'open' } = req.query;

    const { rows } = await pool.query(
      `SELECT * FROM active_security_incidents 
       WHERE incident_status = $1
       ORDER BY 
         CASE severity 
           WHEN 'critical' THEN 1 
           WHEN 'high' THEN 2 
         END,
         detected_at DESC`,
      [status]
    );

    res.json({
      success: true,
      data: rows
    });
});

/**
 * Mettre à jour le statut d'un incident de sécurité
 * PATCH /api/smart-assistant/security-incidents/:id
 */
export const updateSecurityIncident = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, actions_taken, resolution_notes } = req.body;

    const { rows } = await pool.query(
      `UPDATE security_incidents 
       SET status = $1, 
           actions_taken = COALESCE($2, actions_taken),
           resolution_notes = COALESCE($3, resolution_notes),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, actions_taken, resolution_notes, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Incident non trouvé'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });
});

/**
 * Obtenir l'historique d'une session
 * GET /api/smart-assistant/session/:session_key
 */
export const getSessionHistory = asyncHandler(async (req, res) => {
    const { session_key } = req.params;
    const { limit = 50 } = req.query;

    const { rows } = await pool.query(
      `SELECT * FROM smart_assistant_logs 
       WHERE session_key = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [session_key, limit]
    );

    res.json({
      success: true,
      data: rows.reverse()
    });
});

/**
 * Obtenir les métriques en temps réel
 * GET /api/smart-assistant/metrics/realtime
 */
export const getRealtimeMetrics = asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM smart_assistant_metrics 
       WHERE metric_date = CURRENT_DATE
       ORDER BY hour DESC
       LIMIT 24`
    );

    const totals = {
      total_messages: rows.reduce((sum, r) => sum + r.total_messages, 0),
      tickets_created: rows.reduce((sum, r) => sum + r.tickets_created, 0),
      security_incidents: rows.reduce((sum, r) => sum + r.security_incidents_detected, 0),
      avg_processing_time: Math.round(rows.reduce((sum, r) => sum + (r.avg_processing_time_ms || 0), 0) / (rows.length || 1))
    };

    res.json({
      success: true,
      data: {
        hourly: rows,
        totals
      }
    });
});

/**
 * Analyser un message sans créer de ticket (pour prévisualisation)
 * POST /api/smart-assistant/analyze
 */
export const analyzeMessage = asyncHandler(async (req, res) => {
    const { message } = req.body;
    const userId = req.user?.id;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le message ne peut pas être vide'
      });
    }

    const sentiment = smartAssistantService.analyzeSentiment 
      ? await import('../services/sentimentAnalyzer.js').then(m => m.analyzeSentiment(message))
      : { sentiment: 'neutre', score: 0, emotions: [], intensity: 0, isCritical: false };

    const entities = smartAssistantService.extractEntities(message);
    const assetResult = await smartAssistantService.identifyAsset(message, userId);
    const classification = smartAssistantService.classifyTicket(message, sentiment);
    const securityIncident = smartAssistantService.detectSecurityIncident(message, sentiment);

    res.json({
      success: true,
      data: {
        sentiment,
        entities,
        asset: assetResult.asset,
        assetConfidence: assetResult.confidence,
        classification,
        securityIncident
      }
    });
});

/**
 * Synchroniser en masse les cas appris (tickets résolus + articles KB)
 * POST /api/smart-assistant/sync
 */
export const syncLearnedCases = asyncHandler(async (req, res) => {
    const result = await smartAssistantService.syncAll();

    res.json({
      success: true,
      message: `Synchronisation terminée : ${result.synced_tickets} tickets et ${result.synced_articles} articles traités.`,
      data: result
    });
});

export default {
  processSmartMessage,
  getStats,
  getSecurityIncidents,
  updateSecurityIncident,
  getSessionHistory,
  getRealtimeMetrics,
  analyzeMessage,
  syncLearnedCases
};