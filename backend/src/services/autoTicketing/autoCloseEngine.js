// backend/src/services/autoTicketing/autoCloseEngine.js
import pool from '../../db.js';
import emailService from '../emailService.js';

const AUTO_CLOSE_DAYS = 3;

export async function runAutoClose() {
  try {
    // Trouver tous les tickets Résolu depuis plus de 3 jours sans activité
    const { rows: tickets } = await pool.query(
      `SELECT t.*, u.email AS creator_email, u.username AS creator_name
       FROM tickets t
       JOIN users u ON t.created_by = u.id
       WHERE t.status = 'Résolu'
         AND t.resolved_at IS NOT NULL
         AND t.resolved_at < NOW() - INTERVAL '${AUTO_CLOSE_DAYS} days'
         AND t.updated_at < NOW() - INTERVAL '${AUTO_CLOSE_DAYS} days'`
    );

    if (tickets.length === 0) return;

    console.log(`[AutoClose] ${tickets.length} ticket(s) à clôturer automatiquement`);

    for (const ticket of tickets) {
      // Passer à Clôturé
      await pool.query(
        `UPDATE tickets SET status = 'Clôturé', updated_at = NOW() WHERE id = $1`,
        [ticket.id]
      );

      // Historique
      await pool.query(
        `INSERT INTO ticket_history (ticket_id, user_id, action, old_value, new_value)
         VALUES ($1, NULL, 'status_change', 'Résolu', 'Clôturé')`,
        [ticket.id]
      );

      // Notifier le créateur — il a 3 jours se sont passés, si le problème
      // persiste il peut créer un nouveau ticket
      await notifyAutoClose(ticket);

      console.log(`[AutoClose] Ticket #${ticket.id} clôturé automatiquement`);
    }
  } catch (err) {
    console.error('[AutoClose] Erreur :', err.message);
  }
}

async function notifyAutoClose(ticket) {
  const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3001';
  const url = `${FRONTEND}/#/tickets/${ticket.id}`;

  // Notification système en base
  try {
    await pool.query(
      `INSERT INTO notifications (title, message, user_id, "read", ticket_id)
       VALUES ($1, $2, $3, FALSE, $4)`,
      [
        `Ticket #${ticket.id} clôturé automatiquement`,
        `Votre ticket "${ticket.title}" a été clôturé automatiquement après ${AUTO_CLOSE_DAYS} jours sans activité. Si le problème persiste, créez un nouveau ticket.`,
        ticket.created_by,
        ticket.id,
      ]
    );
  } catch (err) {
    console.error('[AutoClose] Erreur notif système :', err.message);
  }

  // Email au créateur
  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;
             overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .header{background:linear-gradient(135deg,#1a1f35,#2980b9);color:#fff;padding:24px 32px}
  .header h2{margin:0;font-size:20px}
  .body{padding:28px 32px;color:#333;line-height:1.6}
  .btn{display:inline-block;margin-top:20px;padding:12px 28px;background:#2980b9;
       color:#fff;text-decoration:none;border-radius:6px;font-weight:600}
  .footer{padding:16px 32px;background:#f9f9f9;font-size:11px;color:#999;
          border-top:1px solid #eee}
  .info-box{background:#f0f7ff;border-left:4px solid #2980b9;padding:12px 16px;
            border-radius:0 6px 6px 0;margin:16px 0}
</style></head><body>
  <div class="container">
    <div class="header">
      <h2>DRESI — ITSM Platform</h2>
      <small>Clôture automatique de ticket</small>
    </div>
    <div class="body">
      <h3 style="margin-top:0">Ticket #${ticket.id} clôturé automatiquement</h3>
      <p>Bonjour <strong>${ticket.creator_name}</strong>,</p>
      <p>Votre ticket a été marqué comme <strong>Résolu</strong> par le technicien
      il y a ${AUTO_CLOSE_DAYS} jours. Faute d'activité, il vient d'être
      clôturé automatiquement.</p>
      <div class="info-box">
        <strong>${ticket.title}</strong><br>
        <small style="color:#666">Résolu le ${new Date(ticket.resolved_at).toLocaleDateString('fr-FR')}</small>
      </div>
      <p>Si le problème <strong>persiste ou est réapparu</strong>, vous pouvez
      créer un nouveau ticket en cliquant sur le bouton ci-dessous.</p>
      <a href="${FRONTEND}/#/tickets/new" class="btn">Créer un nouveau ticket</a>
    </div>
    <div class="footer">
      Cet email a été envoyé automatiquement par la plateforme DRESI ITSM.<br>
      Ne pas répondre à cet email.
    </div>
  </div>
</body></html>`;

  emailService.sendMailDirect(ticket.creator_email, url, html,
    `[ITSM] Ticket #${ticket.id} clôturé automatiquement — ${ticket.title}`
  );
}