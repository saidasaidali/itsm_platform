import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const controllersDir = path.join(root, 'backend/src/controllers');

const SIMPLE = [
  ["message: 'Erreur serveur.'", "message: t(req, 'server_error')"],
  ["message: 'ID invalide.'", "message: t(req, 'invalid_id')"],
  ["message: 'Accès refusé.'", "message: t(req, 'access_denied')"],
  ["message: 'Non authentifié.'", "message: t(req, 'not_authenticated')"],
  ["message: 'Non autorisé.'", "message: t(req, 'not_authorized')"],
  ["message: 'Ticket introuvable.'", "message: t(req, 'ticket_not_found')"],
  ["message: 'Ticket créé.'", "message: t(req, 'ticket_created')"],
  ["message: 'Ticket supprimé.'", "message: t(req, 'ticket_deleted')"],
  ["message: 'Seul un agent peut créer un ticket.'", "message: t(req, 'only_agent_create_ticket')"],
  ["message: 'Équipement introuvable.'", "message: t(req, 'asset_not_found')"],
  ["message: 'Asset introuvable.'", "message: t(req, 'asset_not_found')"],
  ["message: 'Technicien invalide.'", "message: t(req, 'technician_invalid')"],
  ["message: 'Un agent ne peut pas changer le statut.'", "message: t(req, 'agent_cannot_change_status')"],
  ["message: 'Vous n\\'êtes pas assigné à ce ticket.'", "message: t(req, 'not_assigned_to_ticket')"],
  ["message: 'Message obligatoire.'", "message: t(req, 'message_required')"],
  ["message: 'Fournissez un ID de session ou un lien de connexion.'", "message: t(req, 'remote_session_required')"],
  ["message: 'Session à distance initiée. L\\'agent a été notifié.'", "message: t(req, 'remote_session_started')"],
  ["message: 'Session à distance clôturée.'", "message: t(req, 'remote_session_ended')"],
  ["message: 'Utilisateur introuvable.'", "message: t(req, 'user_not_found')"],
  ["message: 'Nom d\\'utilisateur déjà utilisé.'", "message: t(req, 'username_taken')"],
  ["message: 'Email déjà utilisé.'", "message: t(req, 'email_taken')"],
  ["message: 'Rôle invalide.'", "message: t(req, 'invalid_role')"],
  ["message: 'Utilisateur créé.'", "message: t(req, 'user_created')"],
  ["message: 'Utilisateur mis à jour.'", "message: t(req, 'user_updated')"],
  ["message: 'Profil mis à jour.'", "message: t(req, 'profile_updated')"],
  ["message: 'Vous ne pouvez pas modifier votre propre statut.'", "message: t(req, 'cannot_change_own_status')"],
  ["message: 'Vous ne pouvez pas supprimer votre propre compte.'", "message: t(req, 'cannot_delete_self')"],
  ["message: 'Utilisateur supprimé.'", "message: t(req, 'user_deleted')"],
  ["message: 'Identifiants incorrects.'", "message: t(req, 'invalid_credentials')"],
  ["message: 'Votre compte est en attente de validation par un administrateur.'", "message: t(req, 'account_pending')"],
  ["message: 'Votre compte a été désactivé. Contactez un administrateur.'", "message: t(req, 'account_disabled')"],
  ["message: 'Rôle invalide. Seuls les rôles Agent et Technicien sont disponibles à l\\'inscription.'", "message: t(req, 'invalid_register_role')"],
  ["message: 'Compte créé avec succès. Votre demande est en attente de validation par un administrateur.'", "message: t(req, 'register_success')"],
  ["message: 'Déconnexion effectuée.'", "message: t(req, 'logout_success')"],
  ["message: 'Email requis.'", "message: t(req, 'email_required')"],
  ["message: 'Si ce compte existe, un email de réinitialisation a été envoyé.'", "message: t(req, 'reset_email_sent')"],
  ["message: 'Lien invalide ou expiré.'", "message: t(req, 'reset_link_invalid')"],
  ["message: 'Lien valide.'", "message: t(req, 'reset_link_valid')"],
  ["message: 'Le mot de passe doit contenir au moins 6 caractères.'", "message: t(req, 'password_min_length')"],
  ["message: 'Mot de passe réinitialisé avec succès.'", "message: t(req, 'password_reset_success')"],
  ["message: 'Notification introuvable.'", "message: t(req, 'notification_not_found')"],
  ["message: 'Toutes les notifications marquées comme lues.'", "message: t(req, 'all_notifications_read')"],
  ["message: 'Notification supprimée.'", "message: t(req, 'notification_deleted')"],
  ["message: 'Titre et message obligatoires.'", "message: t(req, 'title_message_required')"],
  ["message: 'Anomalie introuvable.'", "message: t(req, 'anomaly_not_found')"],
  ["message: 'Statut invalide.'", "message: t(req, 'invalid_status')"],
  ["message: 'Article introuvable.'", "message: t(req, 'article_not_found')"],
  ["message: 'Article créé.'", "message: t(req, 'article_created')"],
  ["message: 'Article mis à jour.'", "message: t(req, 'article_updated')"],
  ["message: 'Article supprimé.'", "message: t(req, 'article_deleted')"],
  ["message: 'Paramètre q requis.'", "message: t(req, 'param_q_required')"],
  ["message: 'Vous ne pouvez modifier que vos articles.'", "message: t(req, 'can_only_edit_own_articles')"],
  ["message: 'Données invalides.'", "message: t(req, 'invalid_data')"],
  ["message: 'Paramètres système mis à jour.'", "message: t(req, 'system_settings_updated')"],
  ["message: 'Préférences mises à jour.'", "message: t(req, 'preferences_updated')"],
  ["message: 'Asset créé.'", "message: t(req, 'asset_created')"],
  ["message: 'Asset mis à jour.'", "message: t(req, 'asset_updated')"],
  ["message: 'Asset supprimé.'", "message: t(req, 'asset_deleted')"],
  ["message: 'Tag asset déjà existant.'", "message: t(req, 'asset_tag_exists')"],
  ["message: 'serial ou mac_address requis.'", "message: t(req, 'serial_or_mac_required')"],
  ["message: 'Conflit de données, équipement introuvable après doublon.'", "message: t(req, 'asset_conflict')"],
  ["message: 'Ce nom d\\'utilisateur est déjà utilisé.'", "message: t(req, 'username_taken')"],
  ["message: 'Cet email est déjà utilisé.'", "message: t(req, 'email_taken')"],
];

const REGEX_REPLACEMENTS = [
  [/message: `Statut mis à jour : \$\{newStatus\}`/g, "message: t(req, 'status_updated', { status: newStatus })"],
  [/message: `Transition invalide : \$\{ticket\.status\} → \$\{newStatus\}`/g, "message: t(req, 'invalid_transition', { from: ticket.status, to: newStatus })"],
  [/message: `Ticket assigné à \$\{techRows\[0\]\.username\}`/g, "message: t(req, 'ticket_assigned', { username: techRows[0].username })"],
  [/message: `Ticket transféré à \$\{techRows\[0\]\.username\}`/g, "message: t(req, 'ticket_transferred', { username: techRows[0].username })"],
  [/message: `Accès refusé\. Rôle requis : \$\{allowedRoles\.join\(' ou '\)\}\.`/g, "message: t(req, 'role_required', { roles: allowedRoles.join(' / ') })"],
];

for (const file of fs.readdirSync(controllersDir)) {
  if (!file.endsWith('.js')) continue;
  const filePath = path.join(controllersDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes("message:")) continue;

  if (!content.includes("from '../utils/i18n.js'")) {
    const importMatch = content.match(/^import .+\n/m);
    if (importMatch) {
      content = content.replace(importMatch[0], `${importMatch[0]}import { t } from '../utils/i18n.js';\n`);
    } else {
      content = `import { t } from '../utils/i18n.js';\n${content}`;
    }
  }

  for (const [from, to] of SIMPLE) {
    content = content.split(from).join(to);
  }
  for (const [pattern, replacement] of REGEX_REPLACEMENTS) {
    content = content.replace(pattern, replacement);
  }

  fs.writeFileSync(filePath, content);
  console.log('Updated', file);
}

// app.js
const appPath = path.join(root, 'backend/src/app.js');
let appContent = fs.readFileSync(appPath, 'utf8');
if (!appContent.includes("from './utils/i18n.js'")) {
  appContent = appContent.replace(
    "import languageMiddleware from './middlewares/languageMiddleware.js'",
    "import languageMiddleware from './middlewares/languageMiddleware.js'\nimport { t } from './utils/i18n.js'"
  );
  appContent = appContent.replace(
    "allowedHeaders: ['Content-Type', 'Authorization'],",
    "allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],"
  );
  appContent = appContent.replace(
    "message: 'Route introuvable.'",
    "message: t(req, 'route_not_found')"
  );
  appContent = appContent.replace(
    "message: 'Erreur interne du serveur.'",
    "message: t(req, 'internal_server_error')"
  );
  fs.writeFileSync(appPath, appContent);
  console.log('Updated app.js');
}

console.log('Done');
