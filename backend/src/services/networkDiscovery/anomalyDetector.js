// backend/src/services/networkDiscovery/anomalyDetector.js
// Moteur centralisé de détection d'anomalies sur les équipements réseau
import pool from '../../db.js';
import { getFullPrediction } from '../mlService.js';

const SEVERITY = {
  user_mismatch:   'high',
  unknown_device:  'medium',
  mac_change:      'high',
  ip_change:       'low',
  never_seen:      'medium',
  reappeared:      'low',
};

const LABELS = {
  user_mismatch:   '👤 Utilisateur différent détecté',
  unknown_device:  '🆕 Appareil inconnu sur le réseau',
  mac_change:      '🔀 Changement d\'adresse MAC',
  ip_change:       '🌐 Changement d\'adresse IP',
  never_seen:      '👻 Équipement jamais détecté',
  reappeared:      '✅ Équipement réapparu',
};

// ── Enregistrer une anomalie + notifier les admins ────────────
async function raiseAnomaly(assetId, type, description, details = {}) {
  const severity = SEVERITY[type] || 'medium';

  // Éviter les doublons : ne pas re-signaler la même anomalie ouverte dans les 24h
  const { rows: existing } = await pool.query(
    `SELECT id FROM asset_anomalies
     WHERE asset_id = $1 AND anomaly_type = $2 AND status = 'open'
       AND detected_at > NOW() - INTERVAL '24 hours'`,
    [assetId, type]
  );
  if (existing[0]) return existing[0].id;

  const { rows } = await pool.query(
    `INSERT INTO asset_anomalies (asset_id, anomaly_type, severity, description, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [assetId, type, severity, description, JSON.stringify(details)]
  );

  await notifyAdmins(LABELS[type] || 'Anomalie détectée', description, assetId, severity);
  return rows[0].id;
}

async function notifyAdmins(title, message, assetId, severity) {
  const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'medium' ? '🟡' : '🟢';
  const { rows: admins } = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'Admin' AND u.is_active = true`
  );
  for (const admin of admins) {
    await pool.query(
      `INSERT INTO notifications (title, message, user_id, "read", asset_id)
       VALUES ($1,$2,$3,FALSE,$4)`,
      [`${icon} ${title}`, message, admin.id, assetId]
    );
  }
}

// ════════════════════════════════════════════════════════════
// ── Détecteurs individuels ──────────────────────────────────
// ════════════════════════════════════════════════════════════

// 1. PC utilisé par un autre utilisateur que celui affecté
export async function detectUserMismatch(asset, detectedUsername, detectedUserId, ipAddress) {
  if (!asset.assigned_to || !detectedUserId || detectedUserId === asset.assigned_to) return;

  await raiseAnomaly(
    asset.id,
    'user_mismatch',
    `L'équipement "${asset.asset_tag}" est affecté à "${asset.assigned_to_name}" mais utilisé par "${detectedUsername}" (IP: ${ipAddress}).`,
    { expected_user: asset.assigned_to_name, detected_user: detectedUsername, ip: ipAddress }
  );
}

// 2. Machine inconnue sur le réseau (ni dans assets, ni déjà signalée)
export async function detectUnknownDevice(ip, mac, hostname) {
  // Vérifier si déjà dans l'inventaire
  const { rows: known } = await pool.query(
    `SELECT id FROM assets WHERE adresse_mac = $1 OR adresse_ip = $2 LIMIT 1`,
    [mac || null, ip || null]
  );
  if (known[0]) return; // Déjà connu, pas une anomalie

  // Vérifier/mettre à jour la table des appareils inconnus
  const { rows: existing } = await pool.query(
    `SELECT * FROM unknown_devices WHERE mac_address = $1 LIMIT 1`,
    [mac || null]
  );

  if (existing[0]) {
    await pool.query(
      `UPDATE unknown_devices SET last_seen = NOW(), seen_count = seen_count + 1, ip_address = $1
       WHERE id = $2`,
      [ip, existing[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO unknown_devices (ip_address, mac_address, hostname)
       VALUES ($1, $2, $3)`,
      [ip, mac, hostname]
    );

    // Notification globale (pas liée à un asset_id puisqu'il n'existe pas encore)
    const { rows: admins } = await pool.query(
      `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'Admin' AND u.is_active = true`
    );
    for (const admin of admins) {
      await pool.query(
        `INSERT INTO notifications (title, message, user_id, "read")
         VALUES ($1,$2,$3,FALSE)`,
        [
          '🆕 Appareil inconnu sur le réseau',
          `Un appareil non répertorié a été détecté : ${hostname || 'sans nom'} (IP: ${ip || '—'}, MAC: ${mac || '—'}).`,
          admin.id,
        ]
      );
    }
  }
}

// 3. Changement d'adresse MAC pour un équipement connu (carte réseau remplacée, ou usurpation)
export async function detectMacChange(asset, newMac) {
  if (!asset.adresse_mac || !newMac || asset.adresse_mac === newMac) return;

  await raiseAnomaly(
    asset.id,
    'mac_change',
    `L'adresse MAC de "${asset.asset_tag}" a changé : ${asset.adresse_mac} → ${newMac}. Vérifier s'il s'agit d'une carte réseau remplacée ou d'une anomalie.`,
    { old_mac: asset.adresse_mac, new_mac: newMac }
  );
}

// 4. Changement d'adresse IP (gravité faible, normal en DHCP, mais tracé)
export async function detectIpChange(asset, newIp) {
  if (!asset.adresse_ip || !newIp || asset.adresse_ip === newIp) return;

  await raiseAnomaly(
    asset.id,
    'ip_change',
    `L'adresse IP de "${asset.asset_tag}" a changé : ${asset.adresse_ip} → ${newIp}.`,
    { old_ip: asset.adresse_ip, new_ip: newIp }
  );
}

// 5. Équipement jamais vu depuis sa création (créé manuellement mais jamais détecté sur le réseau)
export async function detectNeverSeen(daysThreshold = 7) {
  const { rows } = await pool.query(
    `SELECT id, asset_tag, created_at FROM assets
     WHERE last_seen_at IS NULL
       AND created_at < NOW() - INTERVAL '${daysThreshold} days'
       AND status != 'Retiré'
       AND type IN ('Ordinateur', 'Imprimante', 'Switch', 'Serveur')`
  );
  for (const asset of rows) {
    await raiseAnomaly(
      asset.id,
      'never_seen',
      `"${asset.asset_tag}" n'a jamais été détecté sur le réseau depuis sa création (${new Date(asset.created_at).toLocaleDateString('fr-FR')}). Vérifier qu'il est bien en service.`,
      { created_at: asset.created_at }
    );
  }
  return rows.length;
}

// 6. Équipement réapparu après une longue absence (positif, mais à tracer)
export async function detectReappeared(asset, daysAbsent) {
  if (daysAbsent < 3) return; // Pas significatif si absent moins de 3 jours

  await raiseAnomaly(
    asset.id,
    'reappeared',
    `"${asset.asset_tag}" est réapparu sur le réseau après ${daysAbsent} jour(s) d'absence.`,
    { days_absent: daysAbsent }
  );
}

// ── Détection d'absence prolongée (équipements disparus) ──────
export async function detectMissingDevices(daysThreshold = 3) {
  const { rows: missing } = await pool.query(
    `SELECT id, asset_tag, last_seen_at FROM assets
     WHERE last_seen_at IS NOT NULL
       AND last_seen_at < NOW() - INTERVAL '${daysThreshold} days'
       AND status != 'Retiré'
       AND type IN ('Ordinateur', 'Imprimante', 'Switch', 'Serveur')`
  );

  for (const asset of missing) {
    const daysSince = Math.floor((Date.now() - new Date(asset.last_seen_at)) / 86400000);
    await raiseAnomaly(
      asset.id,
      'never_seen',
      `🔴 "${asset.asset_tag}" n'a pas répondu depuis ${daysSince} jour(s) (dernière détection : ${new Date(asset.last_seen_at).toLocaleString('fr-FR')}).`,
      { last_seen: asset.last_seen_at, days_missing: daysSince }
    );
  }
  return missing.length;
}


export async function detectMLAnomalies(assetId, anomalyScore, riskScore, failureProba) {
  if (!anomalyScore) {
    const prediction = await getFullPrediction(assetId);
    if (!prediction?.anomaly?.is_anomaly) return;
    anomalyScore = prediction.anomaly.anomaly_score;
    riskScore = prediction.risk.score;
    failureProba = prediction.failure.failure_probability;
  }

  const severity = anomalyScore >= 70 ? 'high' : 'medium';

  await raiseAnomaly(
    assetId,
    'ml_anomaly',
    `Anomalie détectée par le modèle ML (Isolation Forest) — score: ${anomalyScore}/100`,
    { anomaly_score: anomalyScore, risk_score: riskScore, failure_proba: failureProba }
  );
}
export default {
  detectUserMismatch,
  detectUnknownDevice,
  detectMacChange,
  detectIpChange,
  detectNeverSeen,
  detectReappeared,
  detectMissingDevices,
  detectMLAnomalies,
};