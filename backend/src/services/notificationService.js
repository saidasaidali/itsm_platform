// backend/src/services/notificationService.js
import pool from '../db.js';

export async function createNotification({ userId, title, message, ticketId = null }) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, "read", ticket_id)
       VALUES ($1, $2, $3, FALSE, $4)`,
      [userId, title, message, ticketId || null]
    );
  } catch (err) {
    console.error('[notificationService] Erreur création notification:', err.message);
  }
}

export async function notifyAdmins(payload) {
  try {
    // Utilise la jointure roles pour trouver les admins — cohérent avec le reste du projet
    const { rows: admins } = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'Admin' AND u.status = 'active'`
    );

    if (admins.length === 0) {
      console.warn('[notificationService] Aucun administrateur actif trouvé.');
      return;
    }

    let title, message;

    if (payload.type === 'comment_sentiment_alert') {
      title   = `Commentaire critique — Ticket #${payload.ticketId}`;
      message = `Un commentaire sur le ticket "${payload.ticketTitle}" a été détecté comme critique.\n` +
                `Sentiment : ${payload.sentiment} (score : ${payload.score ?? 'N/A'}/100)`;
    } else {
      title   = `Alerte sentiment — Ticket #${payload.ticketId}`;
      message = `Le ticket "${payload.ticketTitle}" a un sentiment ${payload.sentiment} critique.\n` +
                `Score : ${payload.score ?? 'N/A'}/100` +
                (payload.reasons  ? `\nRaison : ${payload.reasons}`   : '') +
                (payload.priority ? `\nPriorité suggérée : ${payload.priority}` : '');
    }

    for (const admin of admins) {
      await createNotification({
        userId:   admin.id,
        title,
        message,
        ticketId: payload.ticketId || null,
      });
    }

    console.log(`[notificationService] ${admins.length} admin(s) notifié(s) — type : ${payload.type}`);
  } catch (err) {
    console.error('[notificationService] Erreur notifyAdmins:', err.message);
    throw err;
  }
}

export default { createNotification, notifyAdmins };