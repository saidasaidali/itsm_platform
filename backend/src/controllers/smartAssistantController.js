// backend/src/controllers/smartAssistantController.js
// Contrôleur pour le Smart IT Assistant
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
      return res.status(400).json({
        success: false,
        message: 'Le message ne peut pas être vide'
      });
    }

    const sessionKey = session_key || `session-${Date.now()}`;

    // Traiter le message avec le pipeline intelligent
    const result = await smartAssistantService.processSmartMessage(message, userId, sessionKey);

    // Sauvegarder le log en base de données
    try {
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
          result.analysis.intent,
          result.analysis.confidence || 0.8,
          result.analysis.sentiment.sentiment,
          result.analysis.sentiment.score,
          JSON.stringify(result.analysis.sentiment.emotions),
          result.analysis.sentiment.intensity,
          result.analysis.sentiment.isCritical,
          JSON.stringify(result.metadata.entitiesDetected ? {} : {}),
          result.analysis.asset?.id || null,
          result.analysis.asset ? 0.8 : 0,
          result.analysis.asset ? 'identified' : null,
          result.analysis.classification?.category || null,
          result.analysis.classification?.priority || null,
          result.analysis.classification?.confidence || null,
          result.analysis.mlPrediction?.risk_score || null,
          result.analysis.mlPrediction?.risk_level || null,
          result.analysis.technician?.id || null,
          result.analysis.technician?.score || null,
          result.analysis.securityIncident?.isSecurityIncident || false,
          result.analysis.securityIncident?.type || null,
          result.analysis.securityIncident?.severity || null,
          result.analysis.ticketCreated?.id || null,
          result.metadata.processingTime,
          result.response,
          JSON.stringify(result.sources)
        ]
      );
    } catch (logError) {
      console.error('[SmartAssistant] Erreur sauvegarde log:', logError.message);
      // Ne pas bloquer la réponse si le log échoue
    }

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
      data: rows.reverse() // Plus ancien en premier
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

    // Calculer les totaux du jour
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

    // Effectuer seulement l'analyse sans créer de ticket
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

export default {
  processSmartMessage,
  getStats,
  getSecurityIncidents,
  updateSecurityIncident,
  getSessionHistory,
  getRealtimeMetrics,
  analyzeMessage
};