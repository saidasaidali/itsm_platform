// backend/src/controllers/ticketController.js
import { validationResult } from 'express-validator';
import pool from '../db.js';
import emailService from '../services/emailService.js';
import suggestionEngine from '../services/autoTicketing/suggestionEngine.js';
// ─── Historique ───────────────────────────────────────────────────────────────
async function addHistory(ticketId, userId, action, oldValue = null, newValue = null) {
  await pool.query(
    `INSERT INTO ticket_history (ticket_id, user_id, action, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5)`,
    [ticketId, userId, action, oldValue, newValue]
  );
}

// ─── Assignation automatique ──────────────────────────────────────────────────
async function autoAssign() {
  const { rows } = await pool.query(`
    SELECT u.id, COUNT(t.id) AS active_count
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN tickets t ON t.assigned_to = u.id
      AND t.status NOT IN ('Résolu', 'Clôturé')
    WHERE r.name = 'Technicien' AND u.status = 'active'
    GROUP BY u.id
    ORDER BY active_count ASC
    LIMIT 1
  `);
  return rows.length > 0 ? rows[0].id : null;
}

// ─── Transitions autorisées ───────────────────────────────────────────────────
const ALLOWED_TRANSITIONS = {
  'Nouveau':    ['Assigné'],
  'Assigné':    ['En cours'],
  'En cours':   ['En attente', 'Résolu'],
  'En attente': ['En cours'],
  'Résolu':     ['Clôturé', 'Rouvert'],
  'Rouvert':    ['En cours'],
};

// ─── GET /api/tickets/stats ───────────────────────────────────────────────────
export async function getTicketStats(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Nouveau')    AS open,
         COUNT(*) FILTER (WHERE status = 'En cours')   AS in_progress,
         COUNT(*) FILTER (WHERE status = 'Résolu')     AS resolved,
         COUNT(*) FILTER (WHERE status = 'Clôturé')    AS closed,
         COUNT(*)                                       AS total
       FROM tickets`
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[getTicketStats]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── GET /api/tickets ─────────────────────────────────────────────────────────
export async function getTickets(req, res) {
  const { role, id: userId } = req.user;
  const { status, priority } = req.query;

  try {
    let where = 'WHERE 1=1';
    const params = [];

    if (role === 'Technicien') {
      params.push(userId);
      where += ` AND t.assigned_to = $${params.length}`;
    } else if (role === 'Agent') {
      params.push(userId);
      where += ` AND t.created_by = $${params.length}`;
    }

    if (status)   { params.push(status);   where += ` AND t.status = $${params.length}`; }
    if (priority) { params.push(priority); where += ` AND t.priority = $${params.length}`; }

    const { rows } = await pool.query(
      `SELECT t.*,
              u1.username AS created_by_name,
              u2.username AS assigned_to_name
       FROM tickets t
       LEFT JOIN users u1 ON t.created_by  = u1.id
       LEFT JOIN users u2 ON t.assigned_to = u2.id
       ${where}
       ORDER BY t.created_at DESC`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getTickets]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── GET /api/tickets/:id ─────────────────────────────────────────────────────
export async function getTicketById(req, res) {
  const { id } = req.params;
  const { role, id: userId } = req.user;
  if (isNaN(id))
    return res.status(400).json({ success: false, message: 'ID invalide.' });

  try {
    const { rows } = await pool.query(
      `SELECT t.*,
              u1.username  AS created_by_name,
              u2.username  AS assigned_to_name,
              a.asset_tag  AS asset_tag,
              a.brand      AS asset_brand,
              a.model      AS asset_model,
              a.status     AS asset_status
       FROM tickets t
       LEFT JOIN users  u1 ON t.created_by  = u1.id
       LEFT JOIN users  u2 ON t.assigned_to = u2.id
       LEFT JOIN assets a  ON t.asset_id    = a.id
       WHERE t.id = $1`,
      [id]
    );
    if (!rows[0])
      return res.status(404).json({ success: false, message: 'Ticket introuvable.' });
    const ticket = rows[0];

    if (role === 'Agent' && ticket.created_by !== userId)
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    if (role === 'Technicien' && ticket.assigned_to !== userId)
      return res.status(403).json({ success: false, message: 'Accès refusé.' });

    let commentQuery = `
      SELECT c.*, u.username AS author_name
      FROM ticket_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = $1`;
    if (role === 'Agent')
      commentQuery += ` AND (c.is_internal = FALSE OR c.is_internal IS NULL)`;
    commentQuery += ` ORDER BY c.created_at ASC`;

    const { rows: comments } = await pool.query(commentQuery, [id]);

    const { rows: history } = await pool.query(
      `SELECT h.*, u.username AS actor_name
       FROM ticket_history h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.ticket_id = $1
       ORDER BY h.created_at ASC`,
      [id]
    );
    let suggestions = null;
    if (!['Résolu', 'Clôturé'].includes(ticket.status)) {
      suggestions = await suggestionEngine.getSuggestions(
        ticket.title, ticket.description, ticket.category, ticket.id
      );
    }
    return res.json({ success: true, data: { ...ticket, comments, history, suggestions } });
  } catch (err) {
    console.error('[getTicketById]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── POST /api/tickets — Agent seulement ──────────────────────────────────────
export async function createTicket(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { role, id: userId } = req.user;
  if (role !== 'Agent')
    return res.status(403).json({ success: false, message: 'Seul un agent peut créer un ticket.' });

  const { title, description, priority, category, asset_id } = req.body;

  let dueDate = new Date();
  if (priority === 'Haute')      dueDate.setHours(dueDate.getHours() + 4);
  else if (priority === 'Basse') dueDate.setHours(dueDate.getHours() + 72);
  else                           dueDate.setHours(dueDate.getHours() + 24);

  try {
    // Vérifier que l'asset existe si fourni
    if (asset_id) {
      const { rows: assetCheck } = await pool.query(
        'SELECT id, asset_tag FROM assets WHERE id = $1', [asset_id]
      );
      if (!assetCheck[0])
        return res.status(400).json({ success: false, message: 'Équipement introuvable.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO tickets
         (title, description, priority, category, created_by, status, due_date, asset_id)
       VALUES ($1, $2, $3, $4, $5, 'Nouveau', $6, $7)
       RETURNING *`,
      [
        title, description,
        priority || 'Moyenne',
        category || null,
        userId, dueDate,
        asset_id ? parseInt(asset_id) : null,
      ]
    );
    const ticket = rows[0];
    await addHistory(ticket.id, userId, 'created', null, 'Nouveau');

    if (asset_id) {
      // Enregistrer dans l'historique de l'asset aussi
      await pool.query(
        `INSERT INTO asset_history (asset_id, user_id, action_type, action)
         VALUES ($1, $2, 'ticket_created', $3)`,
        [asset_id, userId, `Ticket #${ticket.id} "${title}" créé pour cet équipement`]
      );
    }

    // Assignation automatique
    const techId = await autoAssign();
    if (techId) {
      await pool.query(
        `UPDATE tickets SET assigned_to = $1, status = 'Assigné' WHERE id = $2`,
        [techId, ticket.id]
      );
      await addHistory(ticket.id, userId, 'auto_assigned', null, String(techId));
      ticket.assigned_to = techId;
      ticket.status = 'Assigné';
    }
    await emailService.notifyTicketCreated(ticket, req.user.username);
      if (techId) {
        await emailService.notifyAssigned(ticket, techId, req.user.username);
}


    // ── Suggestions automatiques pour le créateur ──────────────
    const suggestions = await suggestionEngine.getSuggestions(
      title, description, category, ticket.id
    );

    return res.status(201).json({
      success: true,
      message: 'Ticket créé.',
      data: ticket,
      suggestions, // ← le frontend peut les afficher immédiatement
    });
  } catch (err) {
    console.error('[createTicket]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── PATCH /api/tickets/:id/status ───────────────────────────────────────────
export async function updateStatus(req, res) {
  const { id } = req.params;
  const { status: newStatus } = req.body;
  const { role, id: userId } = req.user;
  if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });

  try {
    const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Ticket introuvable.' });
    const ticket = rows[0];

    const allowed = ALLOWED_TRANSITIONS[ticket.status] || [];
    if (!allowed.includes(newStatus))
      return res.status(400).json({
        success: false,
        message: `Transition invalide : ${ticket.status} → ${newStatus}`,
        allowed,
      });

    if (role === 'Agent')
      return res.status(403).json({ success: false, message: 'Un agent ne peut pas changer le statut.' });
    if (role === 'Technicien' && ticket.assigned_to !== userId)
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas assigné à ce ticket.' });

    await pool.query(
      `UPDATE tickets
       SET status = $1,
           resolved_at = ${newStatus === 'Résolu' ? 'NOW()' : 'resolved_at'},
           updated_at = NOW()
       WHERE id = $2`,
      [newStatus, id]
    );
    await addHistory(id, userId, 'status_change', ticket.status, newStatus);
    await emailService.notifyStatusChange(ticket, newStatus, req.user.username, ticket.created_by);
        if (newStatus === 'Clôturé') {
        await emailService.notifyClosed(ticket, ticket.created_by, req.user.username);
    }
    return res.json({ success: true, message: `Statut mis à jour : ${newStatus}` });
  } catch (err) {
    console.error('[updateStatus]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
  
}

// ─── PATCH /api/tickets/:id/assign — Admin seulement ─────────────────────────
export async function assignTicket(req, res) {
  const { id } = req.params;
  const { technicianId } = req.body;
  const { id: userId } = req.user;
  if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });

  try {
    const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Ticket introuvable.' });

    const { rows: techRows } = await pool.query(
      `SELECT u.id, u.username FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND r.name = 'Technicien'`,
      [technicianId]
    );
    if (!techRows[0]) return res.status(400).json({ success: false, message: 'Technicien invalide.' });

    await pool.query(
      `UPDATE tickets SET assigned_to = $1, status = 'Assigné', updated_at = NOW() WHERE id = $2`,
      [technicianId, id]
    );
    await addHistory(id, userId, 'manual_assigned', String(rows[0].assigned_to), String(technicianId));
    await emailService.notifyAssigned(rows[0], technicianId, req.user.username);
    return res.json({ success: true, message: `Ticket assigné à ${techRows[0].username}` });
  } catch (err) {
    console.error('[assignTicket]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── PATCH /api/tickets/:id/transfer — Technicien seulement ──────────────────
export async function transferTicket(req, res) {
  const { id } = req.params;
  const { technicianId } = req.body;
  const { id: userId } = req.user;
  if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });

  try {
    const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Ticket introuvable.' });
    if (rows[0].assigned_to !== userId)
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas assigné à ce ticket.' });

    const { rows: techRows } = await pool.query(
      `SELECT u.id, u.username FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND r.name = 'Technicien' AND u.id != $2`,
      [technicianId, userId]
    );
    if (!techRows[0]) return res.status(400).json({ success: false, message: 'Technicien invalide.' });

    await pool.query(
      `UPDATE tickets SET assigned_to = $1, updated_at = NOW() WHERE id = $2`,
      [technicianId, id]
    );
    await addHistory(id, userId, 'transferred', String(userId), String(technicianId));

    return res.json({ success: true, message: `Ticket transféré à ${techRows[0].username}` });
  } catch (err) {
    console.error('[transferTicket]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── POST /api/tickets/:id/comments ──────────────────────────────────────────
export async function addComment(req, res) {
  const { id } = req.params;
  const { message, is_internal } = req.body;
  const { role, id: userId } = req.user;
  if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });
  if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message obligatoire.' });

  const internal = (role === 'Technicien' || role === 'Admin') && is_internal === true;

  try {
    const { rows: ticketRows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (!ticketRows[0]) return res.status(404).json({ success: false, message: 'Ticket introuvable.' });

    if (role === 'Agent' && ticketRows[0].created_by !== userId)
      return res.status(403).json({ success: false, message: 'Accès refusé.' });

    // ✅ Utilise user_id (pas author_id)
    const { rows } = await pool.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, message, is_internal)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, userId, message.trim(), internal]
    );
    await pool.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [id]);
    await addHistory(id, userId, internal ? 'internal_note' : 'comment_added', null, message.trim().substring(0, 100));
    await emailService.notifyComment(
      ticketRows[0], req.user.username, internal,
      ticketRows[0].created_by, ticketRows[0].assigned_to
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[addComment]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
  
}

// ─── DELETE /api/tickets/:id — Admin seulement ───────────────────────────────
export async function deleteTicket(req, res) {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID invalide.' });
  try {
    const { rowCount } = await pool.query('DELETE FROM tickets WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ success: false, message: 'Ticket introuvable.' });
    return res.json({ success: true, message: 'Ticket supprimé.' });
  } catch (err) {
    console.error('[deleteTicket]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── GET /api/tickets/asset/:assetId — Tickets d'un équipement ──
export async function getTicketsByAsset(req, res) {
  const { assetId } = req.params;
  if (isNaN(assetId))
    return res.status(400).json({ success: false, message: 'ID invalide.' });

  try {
    const { rows } = await pool.query(
      `SELECT t.*,
              u1.username AS created_by_name,
              u2.username AS assigned_to_name
       FROM tickets t
       LEFT JOIN users u1 ON t.created_by  = u1.id
       LEFT JOIN users u2 ON t.assigned_to = u2.id
       WHERE t.asset_id = $1
       ORDER BY t.created_at DESC`,
      [assetId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getTicketsByAsset]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── GET /api/tickets/reliability — Indicateur fiabilité ─────
export async function getReliabilityAlerts(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM asset_reliability
      WHERE pannes_6mois >= 3
      ORDER BY pannes_6mois DESC
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getReliabilityAlerts]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}