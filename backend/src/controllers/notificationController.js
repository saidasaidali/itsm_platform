// src/controllers/notificationController.js
import pool from '../db.js';
import { t } from '../utils/i18n.js';

// ─── GET /api/notifications ───────────────────────────────────
export async function getNotifications(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getNotifications]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── GET /api/notifications/unread-count ─────────────────────
// ─── GET /api/notifications/unread-count ─────────────────────
export async function getUnreadCount(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM notifications
       WHERE user_id = $1 AND "read" = FALSE`,
      [req.user.id]
    );
    return res.json({ success: true, count: parseInt(rows[0].count) });
  } catch (err) {
    console.error('[getUnreadCount]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── PUT /api/notifications/:id/read ─────────────────────────
export async function markRead(req, res) {
  const { id } = req.params;
  if (isNaN(id))
    return res.status(400).json({ success: false, message: t(req, 'invalid_id') });
  try {
    const { rows } = await pool.query(
      `UPDATE notifications SET "read" = TRUE
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, req.user.id]
    );
    if (!rows[0])
      return res.status(404).json({ success: false, message: t(req, 'notification_not_found') });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[markRead]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── PUT /api/notifications/read-all ─────────────────────────
export async function markAllRead(req, res) {
  try {
    await pool.query(
      `UPDATE notifications SET "read" = TRUE
       WHERE user_id = $1 AND "read" = FALSE`,
      [req.user.id]
    );
    return res.json({ success: true, message: t(req, 'all_notifications_read') });
  } catch (err) {
    console.error('[markAllRead]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── DELETE /api/notifications/:id ───────────────────────────
export async function deleteNotification(req, res) {
  const { id } = req.params;
  if (isNaN(id))
    return res.status(400).json({ success: false, message: t(req, 'invalid_id') });
  try {
    await pool.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );
    return res.json({ success: true, message: t(req, 'notification_deleted') });
  } catch (err) {
    console.error('[deleteNotification]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── GET /api/notifications/preferences ──────────────────────
export async function getPreferences(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [req.user.id]
    );
    // Créer les préférences si elles n'existent pas encore
    if (!rows[0]) {
      const { rows: created } = await pool.query(
        `INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *`,
        [req.user.id]
      );
      return res.json({ success: true, data: created[0] });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[getPreferences]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── PUT /api/notifications/preferences ──────────────────────
export async function updatePreferences(req, res) {
  const {
    email_ticket_created, email_status_change, email_assigned,
    email_comment, email_sla_breach, email_closed, web_notifications,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO notification_preferences
         (user_id, email_ticket_created, email_status_change, email_assigned,
          email_comment, email_sla_breach, email_closed, web_notifications)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id) DO UPDATE SET
         email_ticket_created = EXCLUDED.email_ticket_created,
         email_status_change  = EXCLUDED.email_status_change,
         email_assigned       = EXCLUDED.email_assigned,
         email_comment        = EXCLUDED.email_comment,
         email_sla_breach     = EXCLUDED.email_sla_breach,
         email_closed         = EXCLUDED.email_closed,
         web_notifications    = EXCLUDED.web_notifications,
         updated_at           = NOW()
       RETURNING *`,
      [
        req.user.id,
        email_ticket_created ?? true,
        email_status_change  ?? true,
        email_assigned       ?? true,
        email_comment        ?? true,
        email_sla_breach     ?? true,
        email_closed         ?? true,
        web_notifications    ?? true,
      ]
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[updatePreferences]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// ─── POST /api/notifications — Admin ─────────────────────────
export async function createNotification(req, res) {
  const { title, message, user_id } = req.body;
  if (!title || !message)
    return res.status(400).json({ success: false, message: t(req, 'title_message_required') });
  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications (title, message, user_id) VALUES ($1,$2,$3) RETURNING *`,
      [title, message, user_id || null]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[createNotification]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}