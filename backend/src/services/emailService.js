// src/services/emailService.js
import nodemailer from 'nodemailer';
import pool from '../db.js';

// ─── Transporter SMTP ────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Vérifier la connexion au démarrage ──────────────────────
transporter.verify((err) => {
  if (err) console.warn('[EmailService] SMTP non configuré :', err.message);
  else     console.log('[EmailService] ✅ SMTP prêt');
});

// ─── Template HTML de base ───────────────────────────────────
function buildHtml(title, body, actionUrl = null, actionLabel = null) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: #fff;
               border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { background: linear-gradient(135deg,#1a1f35,#2980b9); color:#fff; padding:24px 32px; }
  .header h2 { margin:0; font-size:20px; }
  .header small { opacity:0.7; font-size:12px; }
  .body { padding: 28px 32px; color: #333; line-height: 1.6; }
  .badge { display:inline-block; padding:4px 12px; border-radius:12px;
           font-size:12px; font-weight:600; margin-bottom:16px; }
  .btn { display:inline-block; margin-top:20px; padding:12px 28px;
         background:#2980b9; color:#fff; text-decoration:none;
         border-radius:6px; font-weight:600; }
  .footer { padding:16px 32px; background:#f9f9f9; font-size:11px;
            color:#999; border-top:1px solid #eee; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <h2>🖥️ DRESI — ITSM Platform</h2>
      <small>Système de gestion des tickets IT</small>
    </div>
    <div class="body">
      <h3 style="margin-top:0">${title}</h3>
      ${body}
      ${actionUrl ? `<a href="${actionUrl}" class="btn">${actionLabel || 'Voir le détail'}</a>` : ''}
    </div>
    <div class="footer">
      Cet email a été envoyé automatiquement par la plateforme DRESI ITSM.<br>
      Ne pas répondre à cet email.
    </div>
  </div>
</body>
</html>`;
}

// ─── Envoyer un email ────────────────────────────────────────
async function sendMail(to, subject, html) {
  if (!process.env.SMTP_USER) {
    console.log(`[EmailService] Email simulé → ${to} : ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('[EmailService] Erreur envoi :', err.message);
  }
}

// ─── Récupérer l'email + préférences d'un utilisateur ────────
async function getUserPref(userId, prefKey) {
  const { rows } = await pool.query(
    `SELECT u.email, u.username, np.${prefKey}
     FROM users u
     LEFT JOIN notification_preferences np ON np.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

// ─── Créer une notification système ──────────────────────────
async function createSystemNotif(userId, title, message) {
  try {
    await pool.query(
      `INSERT INTO notifications (title, message, user_id) VALUES ($1, $2, $3)`,
      [title, message, userId]
    );
  } catch (err) {
    console.error('[EmailService] Erreur notif système :', err.message);
  }
}

// ════════════════════════════════════════════════════════════
// ── Fonctions de notification métier ────────────────────────
// ════════════════════════════════════════════════════════════

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3001';

// 1. Ticket créé → notifier les admins et le technicien assigné
export async function notifyTicketCreated(ticket, creatorName) {
  const url = `${FRONTEND}/#/tickets/${ticket.id}`;

  // Notifier tous les admins
  const { rows: admins } = await pool.query(
    `SELECT u.id, u.email, u.username, COALESCE(np.email_ticket_created, true) AS pref
     FROM users u
     JOIN roles r ON u.role_id = r.id
     LEFT JOIN notification_preferences np ON np.user_id = u.id
     WHERE r.name = 'Admin' AND u.is_active = true`
  );

  for (const admin of admins) {
    await createSystemNotif(
      admin.id,
      `🎫 Nouveau ticket #${ticket.id}`,
      `"${ticket.title}" créé par ${creatorName}`
    );
    if (admin.pref) {
      await sendMail(
        admin.email,
        `[ITSM] Nouveau ticket #${ticket.id} — ${ticket.title}`,
        buildHtml(
          `Nouveau ticket créé`,
          `<p>Bonjour <strong>${admin.username}</strong>,</p>
           <p>Un nouveau ticket a été soumis :</p>
           <table style="width:100%;border-collapse:collapse">
             <tr><td style="padding:6px 0;color:#666">Ticket</td><td><strong>#${ticket.id} — ${ticket.title}</strong></td></tr>
             <tr><td style="padding:6px 0;color:#666">Priorité</td><td>${ticket.priority}</td></tr>
             <tr><td style="padding:6px 0;color:#666">Catégorie</td><td>${ticket.category || '—'}</td></tr>
             <tr><td style="padding:6px 0;color:#666">Créé par</td><td>${creatorName}</td></tr>
           </table>`,
          url, 'Voir le ticket'
        )
      );
    }
  }
}

// 2. Changement de statut → notifier le créateur + admin
export async function notifyStatusChange(ticket, newStatus, actorName, creatorId) {
  const url = `${FRONTEND}/#/tickets/${ticket.id}`;
  const title = `🔄 Ticket #${ticket.id} — ${newStatus}`;
  const msg   = `Le statut est passé à "${newStatus}" par ${actorName}`;

  // Notifier le créateur
  const creator = await getUserPref(creatorId, 'email_status_change');
  if (creator) {
    await createSystemNotif(creatorId, title, msg);
    if (creator.email_status_change !== false) {
      await sendMail(
        creator.email,
        `[ITSM] Ticket #${ticket.id} — Statut : ${newStatus}`,
        buildHtml(
          `Mise à jour de votre ticket`,
          `<p>Bonjour <strong>${creator.username}</strong>,</p>
           <p>Votre ticket a été mis à jour :</p>
           <table style="width:100%;border-collapse:collapse">
             <tr><td style="padding:6px 0;color:#666">Ticket</td><td><strong>#${ticket.id} — ${ticket.title}</strong></td></tr>
             <tr><td style="padding:6px 0;color:#666">Nouveau statut</td><td><strong style="color:#2980b9">${newStatus}</strong></td></tr>
             <tr><td style="padding:6px 0;color:#666">Par</td><td>${actorName}</td></tr>
           </table>`,
          url, 'Voir le ticket'
        )
      );
    }
  }
}

// 3. Ticket assigné → notifier le technicien
export async function notifyAssigned(ticket, technicianId, actorName) {
  const url  = `${FRONTEND}/#/tickets/${ticket.id}`;
  const tech = await getUserPref(technicianId, 'email_assigned');
  if (!tech) return;

  await createSystemNotif(
    technicianId,
    `📋 Ticket #${ticket.id} vous est assigné`,
    `"${ticket.title}" vous a été assigné par ${actorName}`
  );

  if (tech.email_assigned !== false) {
    await sendMail(
      tech.email,
      `[ITSM] Ticket #${ticket.id} vous est assigné`,
      buildHtml(
        `Un ticket vous a été assigné`,
        `<p>Bonjour <strong>${tech.username}</strong>,</p>
         <p>Le ticket suivant vous a été assigné :</p>
         <table style="width:100%;border-collapse:collapse">
           <tr><td style="padding:6px 0;color:#666">Ticket</td><td><strong>#${ticket.id} — ${ticket.title}</strong></td></tr>
           <tr><td style="padding:6px 0;color:#666">Priorité</td><td>${ticket.priority}</td></tr>
           <tr><td style="padding:6px 0;color:#666">Assigné par</td><td>${actorName}</td></tr>
         </table>`,
        url, 'Traiter le ticket'
      )
    );
  }
}

// 4. Commentaire ajouté → notifier les parties concernées
export async function notifyComment(ticket, commentAuthorName, isInternal, creatorId, assignedToId) {
  const url   = `${FRONTEND}/#/tickets/${ticket.id}`;
  const title = `💬 Nouveau commentaire — Ticket #${ticket.id}`;
  const msg   = `${commentAuthorName} a ajouté un commentaire`;

  const targets = new Set();
  if (!isInternal) targets.add(creatorId);
  if (assignedToId) targets.add(assignedToId);

  for (const uid of targets) {
    const user = await getUserPref(uid, 'email_comment');
    if (!user) continue;
    await createSystemNotif(uid, title, msg);
    if (user.email_comment !== false) {
      await sendMail(
        user.email,
        `[ITSM] Ticket #${ticket.id} — Nouveau commentaire`,
        buildHtml(
          `Nouveau commentaire sur votre ticket`,
          `<p>Bonjour <strong>${user.username}</strong>,</p>
           <p>${commentAuthorName} a ajouté un commentaire sur le ticket <strong>#${ticket.id} — ${ticket.title}</strong>.</p>`,
          url, 'Voir le commentaire'
        )
      );
    }
  }
}

// 5. SLA dépassé → notifier admin + technicien assigné
export async function notifySLABreach(ticket) {
  const url   = `${FRONTEND}/#/tickets/${ticket.id}`;
  const title = `⏰ SLA dépassé — Ticket #${ticket.id}`;
  const msg   = `Le ticket "${ticket.title}" a dépassé son délai de résolution`;

  // Admins
  const { rows: admins } = await pool.query(
    `SELECT u.id, u.email, u.username, COALESCE(np.email_sla_breach, true) AS pref
     FROM users u JOIN roles r ON u.role_id = r.id
     LEFT JOIN notification_preferences np ON np.user_id = u.id
     WHERE r.name = 'Admin' AND u.is_active = true`
  );

  for (const admin of admins) {
    await createSystemNotif(admin.id, title, msg);
    if (admin.pref) {
      await sendMail(
        admin.email,
        `[ITSM] ⚠️ SLA dépassé — Ticket #${ticket.id}`,
        buildHtml(
          'Alerte SLA dépassé',
          `<p>Le ticket suivant a dépassé son délai :</p>
           <table style="width:100%;border-collapse:collapse">
             <tr><td style="padding:6px 0;color:#666">Ticket</td><td><strong>#${ticket.id} — ${ticket.title}</strong></td></tr>
             <tr><td style="padding:6px 0;color:#666">Priorité</td><td>${ticket.priority}</td></tr>
             <tr><td style="padding:6px 0;color:#666">Échéance</td><td style="color:red">${new Date(ticket.due_date).toLocaleString('fr-FR')}</td></tr>
           </table>`,
          url, 'Voir le ticket'
        )
      );
    }
  }

  // Technicien assigné
  if (ticket.assigned_to) {
    const tech = await getUserPref(ticket.assigned_to, 'email_sla_breach');
    if (tech) {
      await createSystemNotif(ticket.assigned_to, title, msg);
      if (tech.email_sla_breach !== false) {
        await sendMail(
          tech.email,
          `[ITSM] ⚠️ SLA dépassé — Ticket #${ticket.id}`,
          buildHtml(
            'Alerte SLA dépassé',
            `<p>Bonjour <strong>${tech.username}</strong>,</p>
             <p>Le ticket qui vous est assigné a dépassé son délai SLA.</p>`,
            url, 'Traiter le ticket'
          )
        );
      }
    }
  }
}

// 6. Ticket clôturé → notifier le créateur
export async function notifyClosed(ticket, creatorId, actorName) {
  const url     = `${FRONTEND}/#/tickets/${ticket.id}`;
  const creator = await getUserPref(creatorId, 'email_closed');
  if (!creator) return;

  await createSystemNotif(
    creatorId,
    `✅ Ticket #${ticket.id} clôturé`,
    `Votre ticket a été clôturé par ${actorName}`
  );

  if (creator.email_closed !== false) {
    await sendMail(
      creator.email,
      `[ITSM] Ticket #${ticket.id} — Clôturé`,
      buildHtml(
        'Votre ticket a été clôturé',
        `<p>Bonjour <strong>${creator.username}</strong>,</p>
         <p>Votre ticket <strong>#${ticket.id} — ${ticket.title}</strong> a été clôturé par ${actorName}.</p>
         <p>Si le problème persiste, vous pouvez créer un nouveau ticket.</p>`,
        url, 'Voir le ticket'
      )
    );
  }
}

export default {
  notifyTicketCreated,
  notifyStatusChange,
  notifyAssigned,
  notifyComment,
  notifySLABreach,
  notifyClosed,
};