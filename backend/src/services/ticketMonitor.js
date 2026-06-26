// src/services/ticketMonitor.js
import pool from '../db.js';

async function checkUnassignedTickets() {
  try {
    const { rows: unassigned } = await pool.query(`
      SELECT t.id, t.title, t.created_at
      FROM tickets t
      WHERE t.status = 'Nouveau'
        AND t.assigned_to IS NULL
        AND t.created_at < NOW() - INTERVAL '2 hours'
    `);

    if (unassigned.length === 0) return;

    const { rows: admins } = await pool.query(`
      SELECT u.id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'Admin' AND u.status = 'active'
    `);

    for (const ticket of unassigned) {
      for (const admin of admins) {
        // Vérifier si une notification récente existe déjà pour ce ticket
        const { rows: existing } = await pool.query(`
          SELECT id FROM notifications
          WHERE user_id = $1
            AND message LIKE $2
            AND created_at > NOW() - INTERVAL '3 hours'
        `, [admin.id, `%#${ticket.id}%`]);

        if (existing.length === 0) {
          await pool.query(`
            INSERT INTO notifications (title, message, user_id)
            VALUES ($1, $2, $3)
          `, [
            '⚠️ Ticket non assigné',
            `Le ticket #${ticket.id} "${ticket.title}" n'est pas assigné depuis plus de 2 heures.`,
            admin.id,
          ]);
        }
      }
    }

    if (unassigned.length > 0) {
      console.log(`[TicketMonitor] ${unassigned.length} ticket(s) non assigné(s) signalé(s).`);
    }
  } catch (err) {
    console.error('[TicketMonitor] Erreur :', err.message);
  }
}

checkUnassignedTickets();
setInterval(checkUnassignedTickets, 30 * 60 * 1000);

export default checkUnassignedTickets;