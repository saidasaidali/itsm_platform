// src/services/slaMonitor.js
// Vérifie toutes les 15 minutes les tickets dont le SLA est dépassé
import pool from '../db.js';
import { notifySLABreach } from './emailService.js';

async function checkSLABreaches() {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM tickets
      WHERE status NOT IN ('Résolu', 'Clôturé')
        AND due_date IS NOT NULL
        AND due_date < NOW()
        AND sla_notified IS NOT TRUE
    `);

    for (const ticket of rows) {
      await notifySLABreach(ticket);
      // Marquer comme notifié pour ne pas re-notifier
      await pool.query(
        `UPDATE tickets SET sla_notified = TRUE WHERE id = $1`,
        [ticket.id]
      );
      console.log(`[SLAMonitor] Ticket #${ticket.id} SLA dépassé — notifié`);
    }
  } catch (err) {
    console.error('[SLAMonitor] Erreur :', err.message);
  }
}

checkSLABreaches();
setInterval(checkSLABreaches, 15 * 60 * 1000);

export default checkSLABreaches;