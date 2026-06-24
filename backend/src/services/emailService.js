// backend/src/services/emailService.js
import nodemailer from 'nodemailer';
import pool from '../db.js';
import { getSettings } from './settingsService.js';

// ── Transporter dynamique ─────────────────────────────────────
// Reconstruit à partir des settings actuels à chaque appel de getTransporter(),
// pour refléter les changements SMTP faits depuis l'interface sans redémarrer.
let cachedTransporter = null;
let cachedSignature = null;
let smtpAvailable = false;

function buildSignature(s) {
  return `${s.smtp_host}|${s.smtp_port}|${s.smtp_user}|${s.smtp_pass}`;
}

function getTransporter() {
  const s = getSettings();
  const signature = buildSignature(s);

  if (cachedTransporter && cachedSignature === signature) {
    return cachedTransporter;
  }

  const port = Number(s.smtp_port || 587);
  const secure = port === 465;

  cachedTransporter = nodemailer.createTransport({
    host: s.smtp_host || 'smtp.gmail.com',
    port,
    secure,
    auth: { user: s.smtp_user, pass: s.smtp_pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    // Contourne l'interception TLS par antivirus/pare-feu d'entreprise
    // (Kaspersky, ESET, proxy ministériel, etc.). À retirer en production
    // si le serveur est sur un réseau sans interception SSL.
    tls: { rejectUnauthorized: false },
    logger: true,
    debug: true,
  });
  cachedSignature = signature;

  cachedTransporter.verify((err) => {
    if (err) {
      console.error('[EmailService] Erreur SMTP :', err.message);
      smtpAvailable = false;
    } else {
      console.log('[EmailService] SMTP prêt');
      smtpAvailable = true;
    }
  });

  return cachedTransporter;
}

// ── Template HTML ────────────────────────────────────────────
function buildHtml(title, body, actionUrl = null, actionLabel = null) {
  return `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px}
  .container{max-width:600px;margin:0 auto;background:#fff;border-radius:8px;
             overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .header{background:linear-gradient(135deg,#1a1f35,#2980b9);color:#fff;padding:24px 32px}
  .header h2{margin:0;font-size:20px}
  .header small{opacity:.7;font-size:12px}
  .body{padding:28px 32px;color:#333;line-height:1.6}
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
      <h3 style="margin-top:0">${title}</h3>
      ${body}
      ${actionUrl ? `<a href="${actionUrl}" class="btn">${actionLabel || 'Voir le détail'}</a>` : ''}
    </div>
    <div class="footer">
      Cet email a été envoyé automatiquement par la plateforme DRESI ITSM.<br>
      Ne pas répondre à cet email.
    </div>
  </div>
</body></html>`;
}

// ── Envoi NON BLOQUANT (fire and forget) ─────────────────────
function sendMail(to, subject, html) {
  const s = getSettings();
  if (!s.smtp_user) {
    console.log(`[EmailService] Email ignoré (SMTP non configuré) → ${to}`);
    return;
  }
  const transporter = getTransporter();
  transporter.sendMail({
    from: s.smtp_from || s.smtp_user,
    to, subject, html,
  }).catch((err) => {
    console.error('[EmailService] Erreur envoi (non bloquant) :', err.message);
  });
}

// ── Notification système en base ──────────────────────────────
async function createSystemNotif(userId, title, message, ticketId = null, assetId = null) {
  try {
    await pool.query(
      `INSERT INTO notifications (title, message, user_id, "read", ticket_id, asset_id)
       VALUES ($1, $2, $3, FALSE, $4, $5)`,
      [title, message, userId, ticketId || null, assetId || null]
    );
  } catch (err) {
    console.error('[EmailService] Erreur notif système :', err.message);
  }
}

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

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:3001';
}

// ── 1. Ticket créé ────────────────────────────────────────────
// actorId : ID de l'agent créateur — les admins qui ont cet ID ne reçoivent
// pas la notification (un admin-agent ne se notifie pas lui-même)
export async function notifyTicketCreated(ticket, creatorName, actorId) {
  const url = `${getFrontendUrl()}/#/tickets/${ticket.id}`;
  const { rows: admins } = await pool.query(
    `SELECT u.id, u.email, u.username, COALESCE(np.email_ticket_created, true) AS pref
     FROM users u
     JOIN roles r ON u.role_id = r.id
     LEFT JOIN notification_preferences np ON np.user_id = u.id
     WHERE r.name = 'Admin' AND u.status = 'active'`
  );
  for (const admin of admins) {
    if (admin.id === actorId) continue;

    await createSystemNotif(
      admin.id,
      `Nouveau ticket #${ticket.id}`,
      `"${ticket.title}" créé par ${creatorName}`,
      ticket.id
    );
    if (admin.pref) {
      sendMail(
        admin.email,
        `[ITSM] Nouveau ticket #${ticket.id} — ${ticket.title}`,
        buildHtml('Nouveau ticket créé',
          `<p>Bonjour <strong>${admin.username}</strong>,</p>
           <table style="width:100%;border-collapse:collapse">
             <tr><td style="padding:6px 0;color:#666">Ticket</td>
                 <td><strong>#${ticket.id} — ${ticket.title}</strong></td></tr>
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

// ── 2. Changement de statut ───────────────────────────────────
// actorId : ID du technicien/admin qui change le statut
// Si le créateur est l'acteur, il ne reçoit pas la notification
export async function notifyStatusChange(ticket, newStatus, actorName, creatorId, actorId) {
  if (creatorId === actorId) return;

  const url   = `${getFrontendUrl()}/#/tickets/${ticket.id}`;
  const title = `Ticket #${ticket.id} — ${newStatus}`;
  const msg   = `Le statut est passé à "${newStatus}" par ${actorName}`;
  const creator = await getUserPref(creatorId, 'email_status_change');
  if (!creator) return;
  await createSystemNotif(creatorId, title, msg, ticket.id);
  if (creator.email_status_change !== false) {
    sendMail(
      creator.email,
      `[ITSM] Ticket #${ticket.id} — Statut : ${newStatus}`,
      buildHtml('Mise à jour de votre ticket',
        `<p>Bonjour <strong>${creator.username}</strong>,</p>
         <table style="width:100%;border-collapse:collapse">
           <tr><td style="padding:6px 0;color:#666">Ticket</td>
               <td><strong>#${ticket.id} — ${ticket.title}</strong></td></tr>
           <tr><td style="padding:6px 0;color:#666">Nouveau statut</td>
               <td><strong style="color:#2980b9">${newStatus}</strong></td></tr>
           <tr><td style="padding:6px 0;color:#666">Par</td><td>${actorName}</td></tr>
         </table>`,
        url, 'Voir le ticket'
      )
    );
  }
}

// ── 3. Ticket assigné ─────────────────────────────────────────
// actorId : ID de celui qui déclenche l'assignation (admin ou créateur auto)
// Si le technicien assigné est l'acteur, il ne reçoit pas la notification
export async function notifyAssigned(ticket, technicianId, actorName, actorId) {
  if (technicianId === actorId) return;

  const url  = `${getFrontendUrl()}/#/tickets/${ticket.id}`;
  const tech = await getUserPref(technicianId, 'email_assigned');
  if (!tech) return;
  await createSystemNotif(
    technicianId,
    `Ticket #${ticket.id} vous est assigné`,
    `"${ticket.title}" vous a été assigné par ${actorName}`,
    ticket.id
  );
  if (tech.email_assigned !== false) {
    sendMail(
      tech.email,
      `[ITSM] Ticket #${ticket.id} vous est assigné`,
      buildHtml('Un ticket vous a été assigné',
        `<p>Bonjour <strong>${tech.username}</strong>,</p>
         <table style="width:100%;border-collapse:collapse">
           <tr><td style="padding:6px 0;color:#666">Ticket</td>
               <td><strong>#${ticket.id} — ${ticket.title}</strong></td></tr>
           <tr><td style="padding:6px 0;color:#666">Priorité</td><td>${ticket.priority}</td></tr>
           <tr><td style="padding:6px 0;color:#666">Assigné par</td><td>${actorName}</td></tr>
         </table>`,
        url, 'Traiter le ticket'
      )
    );
  }
}

// ── 4. Commentaire ────────────────────────────────────────────
// actorId : ID de celui qui poste le commentaire
// L'acteur est exclu des destinataires — on ne notifie pas quelqu'un
// de son propre commentaire
export async function notifyComment(ticket, commentAuthorName, isInternal, creatorId, assignedToId, actorId) {
  const url   = `${getFrontendUrl()}/#/tickets/${ticket.id}`;
  const title = `Nouveau commentaire — Ticket #${ticket.id}`;
  const msg   = `${commentAuthorName} a ajouté un commentaire`;
  const targets = new Set();
  if (!isInternal) targets.add(creatorId);
  if (assignedToId) targets.add(assignedToId);

  for (const uid of targets) {
    if (uid === actorId) continue;

    const user = await getUserPref(uid, 'email_comment');
    if (!user) continue;
    await createSystemNotif(uid, title, msg, ticket.id);
    if (user.email_comment !== false) {
      sendMail(
        user.email,
        `[ITSM] Ticket #${ticket.id} — Nouveau commentaire`,
        buildHtml('Nouveau commentaire sur votre ticket',
          `<p>Bonjour <strong>${user.username}</strong>,</p>
           <p>${commentAuthorName} a ajouté un commentaire sur le ticket
           <strong>#${ticket.id} — ${ticket.title}</strong>.</p>`,
          url, 'Voir le commentaire'
        )
      );
    }
  }
}

// ── 5. SLA dépassé ────────────────────────────────────────────
// Pas d'actorId : déclenché par le scheduler, pas par un utilisateur
// Tous les admins et le technicien assigné sont notifiés sans exclusion
export async function notifySLABreach(ticket) {
  const url   = `${getFrontendUrl()}/#/tickets/${ticket.id}`;
  const title = `SLA dépassé — Ticket #${ticket.id}`;
  const msg   = `Le ticket "${ticket.title}" a dépassé son délai de résolution`;
  const { rows: admins } = await pool.query(
    `SELECT u.id, u.email, u.username, COALESCE(np.email_sla_breach, true) AS pref
     FROM users u JOIN roles r ON u.role_id = r.id
     LEFT JOIN notification_preferences np ON np.user_id = u.id
     WHERE r.name = 'Admin' AND u.status = 'active'`
  );
  for (const admin of admins) {
    await createSystemNotif(admin.id, title, msg, ticket.id);
    if (admin.pref) {
      sendMail(
        admin.email,
        `[ITSM] Alerte — SLA dépassé — Ticket #${ticket.id}`,
        buildHtml('Alerte SLA dépassé',
          `<p>Le ticket suivant a dépassé son délai :</p>
           <table style="width:100%;border-collapse:collapse">
             <tr><td style="padding:6px 0;color:#666">Ticket</td>
                 <td><strong>#${ticket.id} — ${ticket.title}</strong></td></tr>
             <tr><td style="padding:6px 0;color:#666">Priorité</td><td>${ticket.priority}</td></tr>
             <tr><td style="padding:6px 0;color:#666">Échéance</td>
                 <td style="color:red">${new Date(ticket.due_date).toLocaleString('fr-FR')}</td></tr>
           </table>`,
          url, 'Voir le ticket'
        )
      );
    }
  }
  if (ticket.assigned_to) {
    const tech = await getUserPref(ticket.assigned_to, 'email_sla_breach');
    if (tech) {
      await createSystemNotif(ticket.assigned_to, title, msg, ticket.id);
      if (tech.email_sla_breach !== false) {
        sendMail(
          tech.email,
          `[ITSM] Alerte — SLA dépassé — Ticket #${ticket.id}`,
          buildHtml('Alerte SLA dépassé',
            `<p>Bonjour <strong>${tech.username}</strong>,</p>
             <p>Le ticket qui vous est assigné a dépassé son délai SLA.</p>`,
            url, 'Traiter le ticket'
          )
        );
      }
    }
  }
}

// ── 6. Ticket clôturé ─────────────────────────────────────────
// actorId : ID de celui qui clôture le ticket
// Si le créateur est l'acteur, il ne reçoit pas la notification
export async function notifyClosed(ticket, creatorId, actorName, actorId) {
  if (creatorId === actorId) return;

  const url     = `${getFrontendUrl()}/#/tickets/${ticket.id}`;
  const creator = await getUserPref(creatorId, 'email_closed');
  if (!creator) return;
  await createSystemNotif(
    creatorId,
    `Ticket #${ticket.id} clôturé`,
    `Votre ticket a été clôturé par ${actorName}`,
    ticket.id
  );
  if (creator.email_closed !== false) {
    sendMail(
      creator.email,
      `[ITSM] Ticket #${ticket.id} — Clôturé`,
      buildHtml('Votre ticket a été clôturé',
        `<p>Bonjour <strong>${creator.username}</strong>,</p>
         <p>Votre ticket <strong>#${ticket.id} — ${ticket.title}</strong>
         a été clôturé par ${actorName}.</p>
         <p>Si le problème persiste, vous pouvez créer un nouveau ticket.</p>`,
        url, 'Voir le ticket'
      )
    );
  }
}

// ── Email de réinitialisation (lien) ──────────────────────────
export async function sendPasswordResetEmail(email, username, resetUrl) {
  sendMail(
    email,
    '[ITSM] Réinitialisation de votre mot de passe',
    buildHtml(
      'Réinitialisation de mot de passe',
      `<p>Bonjour <strong>${username}</strong>,</p>
       <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.</p>
       <p>Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
      resetUrl, 'Réinitialiser mon mot de passe'
    )
  );
}

// ── Email avec mot de passe temporaire (reset admin) ───────────
export async function sendTempPasswordEmail(email, username, tempPassword) {
  const loginUrl = `${getFrontendUrl()}/#/login`;
  sendMail(
    email,
    '[ITSM] Votre mot de passe a été réinitialisé',
    buildHtml(
      'Mot de passe réinitialisé',
      `<p>Bonjour <strong>${username}</strong>,</p>
       <p>Votre mot de passe a été réinitialisé par un administrateur.</p>
       <p>Mot de passe temporaire : <strong style="font-size:16px;letter-spacing:1px">${tempPassword}</strong></p>
       <p>Nous vous recommandons de le modifier dès votre prochaine connexion depuis votre profil.</p>`,
      loginUrl, 'Se connecter'
    )
  );
}

// ── Session à distance initiée ────────────────────────────────
export async function notifyRemoteSession(ticket, technicianName, sessionId, tool, actorId) {
  if (ticket.created_by === actorId) return;

  const url = `${getFrontendUrl()}/#/tickets/${ticket.id}`;
  const toolLabel = tool || 'Outil de prise en main à distance';

  await createSystemNotif(
    ticket.created_by,
    `Session à distance — Ticket #${ticket.id}`,
    `${technicianName} a initié une session ${toolLabel}. Rejoignez la session depuis votre ticket.`,
    ticket.id
  );

  const creator = await getUserPref(ticket.created_by, 'email_status_change');
  if (!creator) return;

  sendMail(
    creator.email,
    `[ITSM] Session à distance initiée — Ticket #${ticket.id}`,
    buildHtml(
      'Session de prise en main à distance',
      `<p>Bonjour <strong>${creator.username}</strong>,</p>
       <p>Le technicien <strong>${technicianName}</strong> a initié une session de prise en main
       à distance pour votre ticket <strong>#${ticket.id} — ${ticket.title}</strong>.</p>
       ${sessionId
         ? `<p>ID de session : <strong style="font-size:16px;letter-spacing:1px">${sessionId}</strong></p>`
         : ''}
       <p>Cliquez sur le bouton ci-dessous pour accéder au ticket et rejoindre la session.</p>`,
      url, 'Rejoindre la session'
    )
  );
}

// Dans emailService.js — exposer sendMail publiquement pour autoCloseEngine
export function sendMailDirect(to, url, html, subject) {
  sendMail(to, subject, html);
}


export async function sendWelcomeEmail(email, fullName, username, tempPassword) {
  const loginUrl = `${getFrontendUrl()}/#/login`;
  sendMail(
    email,
    '[ITSM] Votre compte a été créé — Plateforme DRESI',
    buildHtml(
      'Bienvenue sur la plateforme DRESI ITSM',
      `<p>Bonjour <strong>${fullName}</strong>,</p>
       <p>Votre compte a été créé sur la plateforme ITSM du ministère.</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr>
           <td style="padding:8px 0;color:#666;width:40%">Identifiant</td>
           <td><strong>${username}</strong></td>
         </tr>
         <tr>
           <td style="padding:8px 0;color:#666">Mot de passe temporaire</td>
           <td><strong style="font-size:16px;letter-spacing:2px">${tempPassword}</strong></td>
         </tr>
       </table>
       <p style="color:#e74c3c;font-size:13px">
         Veuillez modifier votre mot de passe dès votre première connexion
         depuis Paramètres → Compte.
       </p>`,
      loginUrl, 'Se connecter'
    )
  );
}
export default {
  notifyTicketCreated,
  notifyStatusChange,
  notifyAssigned,
  notifyComment,
  notifySLABreach,
  notifyClosed,
  sendPasswordResetEmail,
  sendTempPasswordEmail,
  notifyRemoteSession,
  sendMailDirect,
  sendWelcomeEmail,
};