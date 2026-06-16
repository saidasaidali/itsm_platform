// backend/src/services/networkDiscovery/adScan.js
// Lance le script PowerShell de scan AD et traite sa sortie JSON
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PS_SCRIPT = path.join(__dirname, 'scan-ad.ps1');

// ── Exécuter le script PowerShell et récupérer le JSON ────────
function runPowerShellScan() {
  return new Promise((resolve, reject) => {
    const cmd = `powershell.exe -ExecutionPolicy Bypass -File "${PS_SCRIPT}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 20, timeout: 10 * 60 * 1000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`Erreur exécution PowerShell : ${error.message}`));
      }
      try {
        const results = JSON.parse(stdout);
        resolve(Array.isArray(results) ? results : [results]);
      } catch (parseErr) {
        reject(new Error(`Sortie PowerShell invalide : ${parseErr.message}\nSortie brute : ${stdout.slice(0, 500)}`));
      }
    });
  });
}

// ── Traiter un poste détecté : créer ou mettre à jour ─────────
async function processComputer(data) {
  const { hostname, username, ip_address, mac_address, serial, os } = data;
  if (!serial && !mac_address) return null;

  const { rows } = await pool.query(
    `SELECT a.*, u.username AS assigned_to_name
     FROM assets a LEFT JOIN users u ON a.assigned_to = u.id
     WHERE a.numero_serie_fabricant = $1 OR a.adresse_mac = $2
     LIMIT 1`,
    [serial || null, mac_address || null]
  );

  let asset;
  let isNew = false;

  if (!rows[0]) {
    isNew = true;
    const assetTag = `PC-${hostname || serial?.slice(-6) || Date.now()}`;
    const { rows: created } = await pool.query(
      `INSERT INTO assets
         (asset_tag, type, brand, model, status,
          numero_serie_fabricant, adresse_ip, adresse_mac,
          location, last_seen_at, discovery_method)
       VALUES ($1,$2,$3,$4,'En service',$5,$6,$7,'Détecté via scan AD',NOW(),'ad_scan')
       RETURNING *`,
      [assetTag, 'Ordinateur', os || 'Inconnu', hostname || 'Inconnu', serial, ip_address, mac_address]
    );
    asset = created[0];

    await pool.query(
      `INSERT INTO asset_history (asset_id, action_type, action)
       VALUES ($1, 'created', $2)`,
      [asset.id, `Poste détecté automatiquement via scan AD centralisé (utilisateur connecté : "${username}")`]
    );
  } else {
    asset = rows[0];
    await pool.query(
      `UPDATE assets SET
         adresse_ip = $1, adresse_mac = $2,
         last_seen_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [ip_address || null, mac_address || null, asset.id]
    );
  }

  // Détection changement d'utilisateur
  const { rows: userRows } = await pool.query(
    `SELECT id, username FROM users WHERE username ILIKE $1 LIMIT 1`, [username]
  );
  const detectedUserId = userRows[0]?.id || null;

  if (!isNew && detectedUserId && asset.assigned_to && detectedUserId !== asset.assigned_to) {
    await notifyAdmins(
      "⚠️ Changement d'utilisateur détecté",
      `L'équipement "${asset.asset_tag}" était affecté à "${asset.assigned_to_name}" mais utilisé par "${username}" (${ip_address}).`,
      asset.id
    );
    await pool.query(
      `INSERT INTO asset_history (asset_id, action_type, action)
       VALUES ($1, 'modified', $2)`,
      [asset.id, `Utilisateur détecté : "${username}" (attendu : "${asset.assigned_to_name}")`]
    );
  }

  if (isNew) {
    await notifyAdmins(
      '🆕 Nouvel équipement détecté (scan AD)',
      `Poste "${hostname}" ajouté automatiquement. Merci de compléter la fiche.`,
      asset.id
    );
  }

  return { hostname, status: isNew ? 'created' : 'updated', asset_tag: asset.asset_tag };
}

async function notifyAdmins(title, message, assetId) {
  const { rows: admins } = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'Admin' AND u.is_active = true`
  );
  for (const admin of admins) {
    await pool.query(
      `INSERT INTO notifications (title, message, user_id, "read", asset_id)
       VALUES ($1,$2,$3,FALSE,$4)`,
      [title, message, admin.id, assetId]
    );
  }
}

// ── Marquer les postes non vus depuis longtemps ────────────────
async function flagMissingComputers(daysThreshold = 3) {
  const { rows: missing } = await pool.query(
    `SELECT id, asset_tag FROM assets
     WHERE discovery_method = 'ad_scan'
       AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '${daysThreshold} days')
       AND status != 'Retiré'`
  );
  for (const asset of missing) {
    await notifyAdmins(
      '🔴 Équipement non détecté',
      `"${asset.asset_tag}" n'a pas répondu depuis plus de ${daysThreshold} jours. Vérifier sa présence.`,
      asset.id
    );
  }
  return missing.length;
}

// ── Point d'entrée principal ────────────────────────────────────
export async function runADScan() {
  console.log('[ADScan] 🔍 Démarrage du scan Active Directory...');
  try {
    const computers = await runPowerShellScan();
    console.log(`[ADScan] ${computers.length} poste(s) interrogé(s).`);

    const results = { created: 0, updated: 0, failed: 0 };
    for (const comp of computers) {
      try {
        const result = await processComputer(comp);
        if (result) results[result.status === 'created' ? 'created' : 'updated']++;
      } catch (err) {
        results.failed++;
        console.error(`[ADScan] Erreur traitement ${comp.hostname} :`, err.message);
      }
    }

    const missingCount = await flagMissingComputers();

    console.log(`[ADScan] ✅ Terminé — ${results.created} créés, ${results.updated} mis à jour, ${results.failed} échecs, ${missingCount} signalés absents.`);
    return results;
  } catch (err) {
    console.error('[ADScan] ❌ Erreur globale :', err.message);
    return { error: err.message };
  }
}

export default { runADScan };