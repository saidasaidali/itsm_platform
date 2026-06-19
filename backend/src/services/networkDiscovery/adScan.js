// backend/src/services/networkDiscovery/adScan.js
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../../db.js';
import anomalyDetector from './anomalyDetector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PS_SCRIPT = path.join(__dirname, 'scan-ad.ps1');

function runPowerShellScan() {
  return new Promise((resolve, reject) => {
    const cmd = `powershell.exe -ExecutionPolicy Bypass -File "${PS_SCRIPT}"`;
    exec(cmd, { maxBuffer: 1024 * 1024 * 20, timeout: 10 * 60 * 1000 }, (error, stdout) => {
      if (error) return reject(new Error(`Erreur exécution PowerShell : ${error.message}`));
      try {
        const results = JSON.parse(stdout);
        resolve(Array.isArray(results) ? results : [results]);
      } catch (parseErr) {
        reject(new Error(`Sortie PowerShell invalide : ${parseErr.message}\nSortie brute : ${stdout.slice(0, 500)}`));
      }
    });
  });
}

async function processComputer(data) {
  const { hostname, username, ip_address, mac_address, serial, os } = data;
  if (!serial && !mac_address) return null;

  const { rows } = await pool.query(
    `SELECT a.*, u.username AS assigned_to_name
     FROM assets a LEFT JOIN users u ON a.assigned_to = u.id
     WHERE a.serial_number = $1 OR a.adresse_mac = $2
     LIMIT 1`,
    [serial || null, mac_address || null]
  );

  let asset;
  let isNew = false;

  if (!rows[0]) {
    // ── Machine inconnue sur le réseau ──────────────────────
    await anomalyDetector.detectUnknownDevice(ip_address, mac_address, hostname);

    isNew = true;
    const assetTag = `PC-${hostname || serial?.slice(-6) || Date.now()}`;
    try {
      const { rows: created } = await pool.query(
        `INSERT INTO assets
           (asset_tag, type, brand, model, status,
            serial_number, adresse_ip, adresse_mac,
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
    } catch (err) {
      if (err.code === '23505') {
        const { rows: existing } = await pool.query(
          `SELECT a.*, u.username AS assigned_to_name
           FROM assets a LEFT JOIN users u ON a.assigned_to = u.id
           WHERE a.serial_number = $1 OR a.adresse_mac = $2 LIMIT 1`,
          [serial || null, mac_address || null]
        );
        asset = existing[0];
        isNew = false;
      } else {
        throw err;
      }
    }
  } else {
    asset = rows[0];

    // ── Détection de réapparition après absence ─────────────
    if (asset.last_seen_at) {
      const daysSince = Math.floor((Date.now() - new Date(asset.last_seen_at)) / 86400000);
      if (daysSince >= 3) {
        await anomalyDetector.detectReappeared(asset, daysSince);
      }
    }

    // ── Détection changement MAC ─────────────────────────────
    await anomalyDetector.detectMacChange(asset, mac_address);

    // ── Détection changement IP ──────────────────────────────
    await anomalyDetector.detectIpChange(asset, ip_address);

    await pool.query(
      `UPDATE assets SET
         adresse_ip = $1, adresse_mac = $2,
         last_seen_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [ip_address || null, mac_address || null, asset.id]
    );
  }

  // ── Détection utilisateur différent ────────────────────────
  const { rows: userRows } = await pool.query(
    `SELECT id, username FROM users WHERE username ILIKE $1 LIMIT 1`, [username]
  );
  const detectedUserId = userRows[0]?.id || null;

  if (!isNew) {
    await anomalyDetector.detectUserMismatch(asset, username, detectedUserId, ip_address);
  }

  return { hostname, status: isNew ? 'created' : 'updated', asset_tag: asset.asset_tag };
}

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

    // ── Détections globales après le scan ────────────────────
    const missingCount = await anomalyDetector.detectMissingDevices(3);
    const neverSeenCount = await anomalyDetector.detectNeverSeen(7);

    console.log(`[ADScan] ✅ Terminé — ${results.created} créés, ${results.updated} mis à jour, ${results.failed} échecs, ${missingCount} absents, ${neverSeenCount} jamais vus.`);
    return { ...results, missing: missingCount, neverSeen: neverSeenCount };
  } catch (err) {
    console.error('[ADScan] ❌ Erreur globale :', err.message);
    return { error: err.message };
  }
}

export default { runADScan };