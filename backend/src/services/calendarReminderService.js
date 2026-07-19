// backend/src/services/calendarReminderService.js
// Vérifie toutes les minutes les événements du calendrier nécessitant un rappel
import pool from '../db.js';
import { createNotification } from './notificationService.js';
import { sendMail } from './emailService.js';

const REMINDER_TYPES = {
  WEEK_BEFORE: 'week_before',
  DAY_BEFORE: 'day_before',
  HOUR_BEFORE: 'hour_before',
  EVENT_START: 'event_start'
};

const REMINDER_LABELS = {
  [REMINDER_TYPES.WEEK_BEFORE]: 'Rappel J-7',
  [REMINDER_TYPES.DAY_BEFORE]: 'Rappel J-1',
  [REMINDER_TYPES.HOUR_BEFORE]: 'Rappel 1h',
  [REMINDER_TYPES.EVENT_START]: 'Début événement'
};

/**
 * Envoie une notification (in-app + email) pour un événement
 */
async function sendEventReminder(event, userId, reminderType) {
  try {
    const { rows: user } = await pool.query(
      `SELECT u.id, u.email, u.username, np.email_calendar_reminder
       FROM users u
       LEFT JOIN notification_preferences np ON np.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (!user[0]) return;

    const userData = user[0];
    const reminderLabel = REMINDER_LABELS[reminderType];
    const eventDate = new Date(event.start_date);
    const eventDateStr = eventDate.toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const title = `${reminderLabel} — ${event.title}`;
    const message = `Événement prévu le ${eventDateStr}${event.location ? `\nLieu : ${event.location}` : ''}`;

    // Notification in-app
    await createNotification({
      userId: userData.id,
      title,
      message,
      ticketId: event.ticket_id,
      assetId: event.asset_id
    });

    // Email si préférence activée (par défaut: true)
    if (userData.email_calendar_reminder !== false) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      const eventUrl = `${frontendUrl}/#/calendar`;

      sendMail(
        userData.email,
        `[ITSM] ${reminderLabel} — ${event.title}`,
        buildReminderHtml(event, reminderLabel, eventDateStr, eventUrl)
      );
    }

    // Marquer la notification comme envoyée
    await pool.query(
      `UPDATE calendar_notifications
       SET sent_at = NOW(), status = 'sent'
       WHERE event_id = $1 AND user_id = $2 AND notification_type = $3`,
      [event.id, userId, reminderType]
    );

    console.log(`[CalendarReminder] ${reminderLabel} envoyé pour événement #${event.id} à ${userData.username}`);
  } catch (err) {
    console.error(`[CalendarReminder] Erreur envoi rappel ${reminderType}:`, err.message);
  }
}

/**
 * Construit le HTML pour l'email de rappel
 */
function buildReminderHtml(event, reminderLabel, eventDateStr, eventUrl) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
    body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
    .container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;
               overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
    .header{background:linear-gradient(135deg,#1a1f35,#2980b9);color:#fff;padding:24px 32px}
    .header h2{margin:0;font-size:20px}
    .header small{opacity:.7;font-size:12px}
    .body{padding:28px 32px;color:#333;line-height:1.6}
    .event-box{background:#f8f9fa;border-left:4px solid #2980b9;padding:16px;margin:16px 0;
               border-radius:4px}
    .event-box strong{color:#2980b9}
    .btn{display:inline-block;margin-top:20px;padding:12px 28px;background:#2980b9;
         color:#fff;text-decoration:none;border-radius:6px;font-weight:600}
    .footer{padding:16px 32px;background:#f9f9f9;font-size:11px;color:#999;
            border-top:1px solid #eee}
  </style></head><body>
    <div class="container">
      <div class="header">
        <h2>DRESI — ITSM Platform</h2>
        <small>Système de gestion des tickets IT</small>
      </div>
      <div class="body">
        <h3 style="margin-top:0">${reminderLabel}</h3>
        <p>Bonjour,</p>
        <p>Vous avez un événement planifié :</p>
        <div class="event-box">
          <strong>${event.title}</strong><br>
          📅 ${eventDateStr}<br>
          ${event.location ? `📍 ${event.location}<br>` : ''}
          ${event.description ? `📝 ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}` : ''}
        </div>
        <a href="${eventUrl}" class="btn">Voir le calendrier</a>
      </div>
      <div class="footer">
        Cet email a été envoyé automatiquement par la plateforme DRESI ITSM.<br>
        Ne pas répondre à cet email.
      </div>
    </div>
  </body></html>`;
}

/**
 * Vérifie les événements nécessitant un rappel
 */
async function checkCalendarReminders() {
  try {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const inOneDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Récupérer les événements à venir (prochaines 24h) avec leurs rappels
    const { rows: events } = await pool.query(`
      SELECT ce.*, 
             cn.id as notif_id, cn.notification_type, cn.sent_at
      FROM calendar_events ce
      LEFT JOIN calendar_notifications cn ON cn.event_id = ce.id
      WHERE ce.start_date >= NOW()
        AND ce.start_date <= $1
        AND (
          (ce.reminder_1h AND ce.start_date <= $2)
          OR (ce.reminder_1d AND ce.start_date <= $3)
          OR (ce.reminder_start AND ce.start_date <= $4)
        )
    `, [inOneDay.toISOString(), inOneHour.toISOString(), inOneDay.toISOString(), inOneDay.toISOString()]);

    for (const event of events) {
      const eventStart = new Date(event.start_date);
      const eventId = event.id;

      // Récupérer les participants (créateur + assigné + participants)
      const { rows: participants } = await pool.query(`
        SELECT DISTINCT user_id
        FROM (
          SELECT created_by as user_id FROM calendar_events WHERE id = $1
          UNION
          SELECT assigned_to as user_id FROM calendar_events WHERE id = $1 AND assigned_to IS NOT NULL
          UNION
          SELECT user_id FROM calendar_event_participants WHERE event_id = $1
        ) as users
      `, [eventId]);

      for (const participant of participants) {
        const userId = participant.user_id;

        // Vérifier chaque type de rappel
        for (const [reminderType, reminderField] of [
          [REMINDER_TYPES.WEEK_BEFORE, 'reminder_1w'],
          [REMINDER_TYPES.DAY_BEFORE, 'reminder_1d'],
          [REMINDER_TYPES.HOUR_BEFORE, 'reminder_1h'],
          [REMINDER_TYPES.EVENT_START, 'reminder_start']
        ]) {
          // Si le rappel n'est pas activé pour cet événement, skip
          if (reminderField !== 'reminder_start' && !event[reminderField]) continue;
          if (reminderField === 'reminder_start' && !event.reminder_start) continue;

          // Vérifier si déjà envoyé
          const alreadySent = event.notif_id && 
                             event.notification_type === reminderType && 
                             event.sent_at;

          if (alreadySent) continue;

          // Vérifier si on est dans la fenêtre de rappel
          const timeDiff = eventStart.getTime() - now.getTime();
          const hoursDiff = timeDiff / (1000 * 60 * 60);

          let shouldSend = false;

          switch (reminderType) {
            case REMINDER_TYPES.WEEK_BEFORE:
              shouldSend = hoursDiff <= 168 && hoursDiff > 144; // 7 jours (±24h)
              break;
            case REMINDER_TYPES.DAY_BEFORE:
              shouldSend = hoursDiff <= 24 && hoursDiff > 1; // 1 jour (±23h)
              break;
            case REMINDER_TYPES.HOUR_BEFORE:
              shouldSend = hoursDiff <= 1 && hoursDiff > 0; // 1 heure
              break;
            case REMINDER_TYPES.EVENT_START:
              shouldSend = hoursDiff <= 0 && hoursDiff > -1; // Début (±1h après)
              break;
          }

          if (shouldSend) {
            // Créer la notification dans calendar_notifications
            await pool.query(
              `INSERT INTO calendar_notifications (event_id, user_id, notification_type, scheduled_at, status)
               VALUES ($1, $2, $3, NOW(), 'pending')
               ON CONFLICT (event_id, user_id, notification_type) DO UPDATE SET scheduled_at = NOW()
               RETURNING id`,
              [eventId, userId, reminderType]
            );

            // Envoyer le rappel
            await sendEventReminder(event, userId, reminderType);
          }
        }
      }
    }
  } catch (err) {
    console.error('[CalendarReminder] Erreur lors de la vérification:', err.message);
  }
}

// Vérifier toutes les minutes
checkCalendarReminders();
setInterval(checkCalendarReminders, 60 * 1000);

export default checkCalendarReminders;