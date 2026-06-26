// backend/src/services/autoTicketing/autoTicketEngine.js
// Crée automatiquement des tickets quand une anomalie système est détectée
import pool from '../../db.js';
import emailService from '../emailService.js';
import { getFullPrediction, saveRiskScore } from '../mlService.js';

const COOLDOWN_HOURS = 24; // Ne pas re-créer un ticket pour le même problème avant 24h

// ── Trouver le premier admin (créateur des tickets auto) ───────
async function getSystemCreatorId() {
  const { rows } = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'Admin' AND u.status = 'active'
     ORDER BY u.id ASC LIMIT 1`
  );
  if (!rows[0]) throw new Error('Aucun admin actif trouvé pour créer le ticket automatique.');
  return rows[0].id;
}

// ── Vérifier si on est encore dans la période de cooldown ──────
async function isInCooldown(assetId, triggerType) {
  const { rows } = await pool.query(
    `SELECT * FROM auto_ticket_cooldown
     WHERE asset_id = $1 AND trigger_type = $2
       AND created_at > NOW() - INTERVAL '${COOLDOWN_HOURS} hours'`,
    [assetId, triggerType]
  );
  return rows.length > 0;
}

async function setCooldown(assetId, triggerType, ticketId) {
  await pool.query(
    `INSERT INTO auto_ticket_cooldown (asset_id, trigger_type, last_ticket_id, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (asset_id, trigger_type) DO UPDATE SET
       last_ticket_id = EXCLUDED.last_ticket_id, created_at = NOW()`,
    [assetId, triggerType, ticketId]
  );
}

// ── Créer le ticket automatique ─────────────────────────────────
async function createAutoTicket({ assetId, title, description, category, priority, triggerType }) {
  if (await isInCooldown(assetId, triggerType)) {
    return null; // Déjà signalé récemment, on n'en crée pas un autre
  }

  const creatorId = await getSystemCreatorId();

  let dueDate = new Date();
  if (priority === 'Haute')      dueDate.setHours(dueDate.getHours() + 4);
  else if (priority === 'Basse') dueDate.setHours(dueDate.getHours() + 72);
  else                           dueDate.setHours(dueDate.getHours() + 24);

  const { rows } = await pool.query(
    `INSERT INTO tickets
       (title, description, priority, category, created_by, status, due_date,
        asset_id, is_auto_generated, auto_trigger_type)
     VALUES ($1,$2,$3,$4,$5,'Nouveau',$6,$7,TRUE,$8)
     RETURNING *`,
    [title, description, priority, category, creatorId, dueDate, assetId, triggerType]
  );
  const ticket = rows[0];

  await pool.query(
    `INSERT INTO ticket_history (ticket_id, user_id, action, old_value, new_value)
     VALUES ($1, $2, 'auto_created', NULL, 'Nouveau')`,
    [ticket.id, creatorId]
  );

  await pool.query(
    `INSERT INTO asset_history (asset_id, user_id, action_type, action)
     VALUES ($1, $2, 'ticket_created', $3)`,
    [assetId, creatorId, `Ticket automatique #${ticket.id} créé : "${title}"`]
  );

  // Assignation automatique au technicien le moins chargé (réutilise la logique existante)
  const { rows: techRows } = await pool.query(`
    SELECT u.id FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN tickets t ON t.assigned_to = u.id AND t.status NOT IN ('Résolu','Clôturé')
    WHERE r.name = 'Technicien' AND u.status = 'active'
    GROUP BY u.id
    ORDER BY COUNT(t.id) ASC
    LIMIT 1
  `);
  if (techRows[0]) {
    await pool.query(
      `UPDATE tickets SET assigned_to = $1, status = 'Assigné' WHERE id = $2`,
      [techRows[0].id, ticket.id]
    );
    await emailService.notifyAssigned(ticket, techRows[0].id, 'Système (auto-ticketing)');
    ticket.assigned_to = techRows[0].id;
    ticket.status = 'Assigné';
  }

  await emailService.notifyTicketCreated(ticket, 'Système (détection automatique)');
  await setCooldown(assetId, triggerType, ticket.id);

  console.log(`[AutoTicketing] 🎫 Ticket #${ticket.id} créé automatiquement (${triggerType})`);
  return ticket;
}

// ════════════════════════════════════════════════════════════
// ── Règles de détection ─────────────────────────────────────
// ════════════════════════════════════════════════════════════

// 1. PC non vu depuis longtemps
export async function checkMissingComputers(daysThreshold = 3) {
  const { rows } = await pool.query(
    `SELECT id, asset_tag, last_seen_at FROM assets
     WHERE type = 'Ordinateur' AND status != 'Retiré'
       AND last_seen_at IS NOT NULL
       AND last_seen_at < NOW() - INTERVAL '${daysThreshold} days'`
  );

  let created = 0;
  for (const asset of rows) {
    const daysSince = Math.floor((Date.now() - new Date(asset.last_seen_at)) / 86400000);
    const ticket = await createAutoTicket({
      assetId:     asset.id,
      title:       `Poste "${asset.asset_tag}" non détecté depuis ${daysSince} jours`,
      description: `Le système n'a pas réussi à joindre cet équipement depuis ${daysSince} jour(s) ` +
                   `(dernière détection : ${new Date(asset.last_seen_at).toLocaleString('fr-FR')}). ` +
                   `Vérifier qu'il est allumé, connecté au réseau, ou signaler une éventuelle disparition.`,
      category:    'Réseau',
      priority:    'Moyenne',
      triggerType: 'pc_missing',
    });
    if (ticket) created++;
  }
  return created;
}

// 2. Disque plein (espace libre critique)
export async function checkDiskSpace(freeGbThreshold = 5) {
    const { rows } = await pool.query(
      `SELECT a.id, a.asset_tag, a.type, ls.disk_free_gb
       FROM assets a
       JOIN asset_live_state ls ON ls.asset_id = a.id
       WHERE a.type IN ('Ordinateur', 'Serveur')
         AND a.status = 'En service'
         AND ls.disk_free_gb IS NOT NULL
         AND ls.disk_free_gb < $1
         AND ls.disk_free_gb > 0`,
      [freeGbThreshold]
    );

    let created = 0;
    for (const asset of rows) {
      const ticket = await createAutoTicket({
        assetId:     asset.id,
        title:       `Espace disque critique — ${asset.asset_tag} (${asset.disk_free_gb} Go restants)`,
        description: `L'équipement "${asset.asset_tag}" n'a plus que ${asset.disk_free_gb} Go d'espace libre. ` +
                     `Prévoir un nettoyage ou une extension de stockage.`,
        category:    'Matériel',
        priority:    'Haute',
        triggerType: 'disk_full',
      });
      if (ticket) created++;
    }
    return created;
  }

// ── Règle ML : risk score élevé → ticket préventif ────────────────────────────
export async function checkMLRiskScores() {
  const { rows: assets } = await pool.query(
    `SELECT id, asset_tag, type FROM assets
     WHERE type IN ('Ordinateur', 'Serveur', 'Imprimante')
       AND status = 'En service'`
  );

  let created = 0;
  for (const asset of assets) {
    const prediction = await getFullPrediction(asset.id);
    if (!prediction) continue;

    const { risk, failure } = prediction;

    // Sauvegarder le score en base
    await saveRiskScore(asset.id, risk.score, risk.level);

    // Ticket préventif si risque critique ET panne prédite
    if (risk.score >= 75 && failure.failure_predicted) {
      const ticket = await createAutoTicket({
        assetId:     asset.id,
        title:       `[ML] Risque critique — ${asset.asset_tag}`,
        description: `Le modèle ML prédit un risque de panne pour ${asset.asset_tag}.\n` +
                     `Score de risque : ${risk.score}/100 (${risk.level}).\n` +
                     `Probabilité de panne : ${failure.failure_probability}%.`,
        priority:    'Haute',
        category:    'Matériel',
        triggerType: 'ml_high_risk',
      });
      if (ticket) created++;
    }
    // Ticket préventif si risque élevé seulement
    else if (risk.score >= 50) {
      const ticket = await createAutoTicket({
        assetId:     asset.id,
        title:       `[ML] Risque élevé — ${asset.asset_tag}`,
        description: `Score de risque ML : ${risk.score}/100 (${risk.level}).\n` +
                     `Une intervention préventive est recommandée.`,
        priority:    'Moyenne',
        category:    'Matériel',
        triggerType: 'ml_elevated_risk',
      });
      if (ticket) created++;
    }
  }
  return created;
}

// 3. Imprimante hors ligne
export async function checkPrinterOffline(hoursThreshold = 2) {
  const { rows } = await pool.query(
    `SELECT id, asset_tag, last_seen_at FROM assets
     WHERE type = 'Imprimante' AND status != 'Retiré'
       AND last_seen_at IS NOT NULL
       AND last_seen_at < NOW() - INTERVAL '${hoursThreshold} hours'`
  );

  let created = 0;
  for (const asset of rows) {
    const ticket = await createAutoTicket({
      assetId:     asset.id,
      title:       `Imprimante "${asset.asset_tag}" hors ligne`,
      description: `L'imprimante ne répond plus depuis plus de ${hoursThreshold}h ` +
                   `(dernière réponse : ${new Date(asset.last_seen_at).toLocaleString('fr-FR')}). ` +
                   `Vérifier l'alimentation, la connexion réseau, ou un éventuel bourrage papier.`,
      category:    'Imprimante',
      priority:    'Moyenne',
      triggerType: 'printer_offline',
    });
    if (ticket) created++;
  }
  return created;
}

// ── Point d'entrée : exécute toutes les règles ──────────────────
export async function runAutoTicketingChecks() {
  console.log('[AutoTicketing] 🔍 Vérification des règles auto-ticketing...');
  try {
    const missingPC  = await checkMissingComputers(3);
    const diskFull    = await checkDiskSpace(5);
    const printerDown = await checkPrinterOffline(2);

    const total = missingPC + diskFull + printerDown;
    if (total > 0) {
      console.log(`[AutoTicketing] ✅ ${total} ticket(s) créé(s) — PC manquants: ${missingPC}, disque plein: ${diskFull}, imprimantes: ${printerDown}`);
    }
    return { missingPC, diskFull, printerDown, total };
  } catch (err) {
    console.error('[AutoTicketing] ❌ Erreur :', err.message);
    return { error: err.message };
  }
}

export default {
  checkMissingComputers,
  checkDiskSpace,
  checkMLRiskScores,
  checkPrinterOffline,
  runAutoTicketingChecks,
};
