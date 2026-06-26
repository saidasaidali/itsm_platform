// backend/src/controllers/sentimentController.js
import { analyzeSentiment, getSentimentActions } from '../services/sentimentAnalyzer.js';
import pool from '../db.js';
import { notifyAdmins } from '../services/notificationService.js';

// ─── POST /api/sentiment/analyze ─────────────────────────────────────────────
export async function analyzeTextSentiment(req, res) {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Le texte est requis.' });

    const analysis = analyzeSentiment(text);
    const actions  = getSentimentActions(text);
    return res.json({ success: true, analysis, actions });
  } catch (err) {
    console.error('[sentimentController]', err);
    return res.status(500).json({ error: 'Erreur lors de l\'analyse de sentiment.' });
  }
}

// ─── POST /api/sentiment/ticket/:ticketId ─────────────────────────────────────
export async function analyzeTicketSentiment(req, res) {
  try {
    const { ticketId } = req.params;
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Le texte est requis.' });

    const analysis = analyzeSentiment(text);
    const actions  = getSentimentActions(text);

    const { rows } = await pool.query(
      `UPDATE tickets SET
         sentiment              = $1,
         sentiment_score        = $2,
         sentiment_emotions     = $3,
         sentiment_intensity    = $4,
         sentiment_is_critical  = $5,
         sentiment_analyzed_at  = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        analysis.sentiment,
        analysis.score,
        JSON.stringify(analysis.emotions),
        analysis.intensity,
        actions.shouldMarkCritical,
        ticketId,
      ]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Ticket introuvable.' });
    const ticket = rows[0];

    // Passer en priorité Haute si critique et pas déjà haute
    if (actions.shouldMarkCritical && ticket.priority !== 'Haute') {
      await pool.query(
        `UPDATE tickets SET priority = 'Haute' WHERE id = $1`,
        [ticketId]
      );
      ticket.priority = 'Haute';
    }

    // Notifier les admins si nécessaire
    if (actions.shouldNotifyManager) {
      await notifyAdmins({
        type:        'sentiment_alert',
        ticketId:    ticket.id,
        ticketTitle: ticket.title,
        sentiment:   analysis.sentiment,
        score:       analysis.score,
        emotions:    analysis.emotions,
        reasons:     actions.reason,
        priority:    actions.priority,
      }).catch((err) => console.error('[sentimentController] Erreur notif:', err.message));
    }

    return res.json({ success: true, ticket, analysis, actions });
  } catch (err) {
    console.error('[sentimentController]', err);
    return res.status(500).json({ error: 'Erreur lors de l\'analyse du ticket.' });
  }
}

// ─── POST /api/sentiment/comment/:commentId ───────────────────────────────────
export async function analyzeCommentSentiment(req, res) {
  try {
    const { commentId } = req.params;
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Le texte est requis.' });

    const analysis = analyzeSentiment(text);

    // ticket_comments — nom correct de la table dans ce projet
    const { rows } = await pool.query(
      `UPDATE ticket_comments SET
         sentiment             = $1,
         sentiment_score       = $2,
         sentiment_emotions    = $3,
         sentiment_intensity   = $4,
         sentiment_is_critical = $5
       WHERE id = $6
       RETURNING *`,
      [
        analysis.sentiment,
        analysis.score,
        JSON.stringify(analysis.emotions),
        analysis.intensity,
        analysis.isCritical,
        commentId,
      ]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Commentaire introuvable.' });
    const comment = rows[0];

    if (analysis.isCritical) {
      const { rows: ticketRows } = await pool.query(
        `SELECT id, title FROM tickets WHERE id = (
           SELECT ticket_id FROM ticket_comments WHERE id = $1
         )`,
        [commentId]
      );
      if (ticketRows[0]) {
        await notifyAdmins({
          type:        'comment_sentiment_alert',
          ticketId:    ticketRows[0].id,
          ticketTitle: ticketRows[0].title,
          commentId:   comment.id,
          sentiment:   analysis.sentiment,
          score:       analysis.score,
          emotions:    analysis.emotions,
        }).catch((err) => console.error('[sentimentController] Erreur notif commentaire:', err.message));
      }
    }

    return res.json({ success: true, comment, analysis });
  } catch (err) {
    console.error('[sentimentController]', err);
    return res.status(500).json({ error: 'Erreur lors de l\'analyse du commentaire.' });
  }
}

// ─── GET /api/sentiment/critical ─────────────────────────────────────────────
export async function getCriticalTickets(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT
         t.id, t.title, t.status, t.priority,
         t.sentiment, t.sentiment_score, t.sentiment_emotions,
         t.sentiment_intensity, t.sentiment_analyzed_at,
         u.username AS created_by
       FROM tickets t
       JOIN users u ON t.created_by = u.id
       WHERE t.sentiment_is_critical = TRUE
       ORDER BY t.sentiment_analyzed_at DESC
       LIMIT 50`
    );

    const tickets = rows.map((t) => ({
      ...t,
      sentiment_emotions: typeof t.sentiment_emotions === 'string'
        ? JSON.parse(t.sentiment_emotions)
        : (t.sentiment_emotions || []),
    }));

    return res.json({ success: true, tickets, count: tickets.length });
  } catch (err) {
    console.error('[sentimentController]', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des tickets critiques.' });
  }
}

export default {
  analyzeTextSentiment,
  analyzeTicketSentiment,
  analyzeCommentSentiment,
  getCriticalTickets,
};