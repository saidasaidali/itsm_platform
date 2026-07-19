// backend/src/services/networkDiscovery/adScan.js
// Orchestre le scan Active Directory via PowerShell ou en mode simulation
// Architecture centralisée : tout est exécuté depuis le serveur, sans agent sur les postes

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../../db.js';
import anomalyDetector from './anomalyDetector.js';
import { getSettings } from '../settingsService.js';
import { getFakeADComputers } from '../mock/simulationService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PS_SCRIPT = path.join(__dirname, 'scan-ad.ps1');

/**
 * Exécute le script PowerShell scan-ad.ps1 avec les paramètres configurables
 * @returns {Promise<Object>} Résultat contenant computers[] et summary
 */
function runPowerShellScan() {
  return new Promise((resolve, reject) => {
    const s = getSettings();

    const timeoutSec = s.wmi_timeout_sec || 10;
    const maxParallel = s.wmi_max_parallel || 32;
    const retryCount = s.wmi_retry_count || 1;
    const retryDelay = s.wmi_retry_delay_sec || 2;
    const verbose = s.wmi_verbose_logging === true || s.wmi_verbose_logging === 'true';

    // Construire la commande avec les paramètres configurables
    const cmd =
      `powershell.exe -ExecutionPolicy Bypass -File "${PS_SCRIPT}" ` +
      `-TimeoutSec ${timeoutSec} ` +
      `-MaxParallel ${maxParallel} ` +
      `-RetryCount ${retryCount} ` +
      `-RetryDelaySec ${retryDelay}` +
      (verbose ? ' -VerboseLogging' : '');

    // Timeout global : (timeout * tentatives * 2 + 5) * nombre de postes / parallélisme + marge
    const estimatedHosts = 200; // estimation par défaut
    const globalTimeout = Math.max(
      10 * 60 * 1000, // minimum 10 minutes
      Math.ceil((timeoutSec * retryCount * 2 + 5) * estimatedHosts / Math.max(maxParallel, 1)) * 1000 + 30000
    );

    exec(cmd, { maxBuffer: 1024 * 1024 * 20, timeout: globalTimeout }, (error, stdout) => {
      if (error) {
        // Même en cas d'erreur, essayer de parser la sortie partielle
        if (stdout) {
          try {
            const partial = JSON.parse(stdout);
            if (partial.computers || partial.summary) {
              return resolve(partial);
            }
          } catch {
            // Ignorer, l'erreur sera retournée
          }
        }
        return reject(new Error(`Erreur exécution PowerShell : ${error.message}`));
      }
      try {
        const parsed = JSON.parse(stdout);

        // Nouveau format : { computers: [...], summary: {...} }
        if (parsed.computers && Array.isArray(parsed.computers)) {
          return resolve(parsed);
        }

        // Ancien format (rétrocompatibilité) : tableau direct
        if (Array.isArray(parsed)) {
          return resolve({
            computers: parsed,
            summary: {
              total: parsed.length,
              online: parsed.length,
              offline: 0,
              errors: 0,
              duration_ms: 0,
            },
          });
        }

        // Format simple objet (un seul résultat)
        if (parsed.hostname) {
          return resolve({
            computers: [parsed],
            summary: {
              total: 1,
              online: 1,
              offline: 0,
              errors: 0,
              duration_ms: 0,
            },
          });
        }

        reject(new Error('Format de sortie PowerShell non reconnu'));
      } catch (parseErr) {
        reject(new Error(
          `Sortie PowerShell invalide : ${parseErr.message}\nSortie brute : ${stdout.slice(0, 500)}`
        ));
      }
    });
  });
}

/**
  * Détermine le type d'actif depuis le hostname
  * @param {string} hostname - Nom de la machine
  * @returns {string} Type d'actif
  */
function getAssetType(hostname) {
  const h = (hostname || '').toLowerCase();
  if (h.includes('imp')) return 'Imprimante';
  if (h.includes('srv')) return 'Serveur';
  if (h.includes('dev')) return 'Ordinateur';
  if (h.includes('tech')) return 'Ordinateur';
  if (h.includes('user')) return 'Ordinateur';
  return 'Ordinateur';
}

/**
  * Détermine le department depuis le hostname
  * @param {string} hostname - Nom de la machine
  * @returns {string} Department
  */
function getDepartment(hostname) {
  const h = (hostname || '').toLowerCase();
  if (h.includes('imp') || h.includes('user')) return 'Finance';
  if (h.includes('tech')) return 'Informatique';
  if (h.includes('srv')) return 'Datacenter';
  if (h.includes('dev')) return 'Développement';
  return 'Général';
}

/**
  * Détermine l'office depuis le hostname
  * @param {string} hostname - Nom de la machine
  * @returns {string} Office
  */
function getOffice(hostname) {
  const h = (hostname || '').toLowerCase();
  if (h.includes('imp') || h.includes('user')) return 'Bureau A';
  if (h.includes('tech')) return 'Bureau IT';
  if (h.includes('srv')) return 'Salle Serveurs';
  if (h.includes('dev')) return 'Bureau C';
  return 'Bureau Principal';
}

/**
  * Traite un poste découvert : création ou mise à jour dans la base
  * @param {Object} data - Données du poste
  * @returns {Promise<Object|null>} Résultat du traitement
  */
async function processComputer(data) {
  const { hostname, username, ip_address, mac_address, serial, os } = data;
  if (!serial && !mac_address) return null;

  // Déterminer le type et la localisation depuis le hostname
  const assetType = getAssetType(hostname);
  const department = getDepartment(hostname);
  const office = getOffice(hostname);

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

    // Utiliser les informations enrichies si disponibles
    const brand = data.manufacturer || os || 'Inconnu';
    const model = data.model || brand || 'Inconnu';

    try {
      const { rows: created } = await pool.query(
        `INSERT INTO assets
           (asset_tag, type, brand, model, hostname, status,
            serial_number, adresse_ip, adresse_mac,
            department, office, location, last_seen_at, discovery_method)
         VALUES ($1,$2,$3,$4,$5,'En service',$6,$7,$8,$9,$10,'Détecté via scan AD',NOW(),'ad_scan')
         RETURNING *`,
        [assetTag, assetType, brand, model, hostname, serial, ip_address, mac_address, department, office]
      );
      asset = created[0];

      console.log(`[ADScan] Création asset: ${assetTag}, type=${assetType}, ip=${ip_address}, dept=${department}, office=${office}`);

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
         adresse_ip = $1, adresse_mac = $2, hostname = $3,
         department = COALESCE(department, $4),
         office = COALESCE(office, $5),
         last_seen_at = NOW(), updated_at = NOW()
       WHERE id = $6`,
      [ip_address || null, mac_address || null, hostname || null, department, office, asset.id]
    );

    console.log(`[ADScan] Mise à jour asset: ${asset.asset_tag}, ip=${ip_address}, dept=${department}, office=${office}`);
  }

  // ── Détection utilisateur différent ────────────────────────
  const { rows: userRows } = await pool.query(
    `SELECT id, username FROM users WHERE username ILIKE $1 LIMIT 1`, [username]
  );
  const detectedUserId = userRows[0]?.id || null;

  if (!isNew) {
    await anomalyDetector.detectUserMismatch(asset, username, detectedUserId, ip_address);
  }

  return { hostname, status: isNew ? 'created' : 'updated', asset_tag: asset.asset_tag, type: assetType };
}

/**
 * Lance un scan AD complet
 * @returns {Promise<Object>} Statistiques du scan
 */
export async function runADScan() {
  const startTime = Date.now();
  const settings = getSettings();

  // ── Mode simulation ──────────────────────────────────────────
  if (settings.simulation_mode === true || settings.simulation_mode === 'true') {
    console.log('[Simulation] AD Scan - Utilisation des données simulées');
    const fakeComputers = getFakeADComputers();
    const computers = fakeComputers.map(c => ({
      hostname: c.hostname,
      username: c.utilisateur,
      ip_address: c.ip,
      mac_address: c.mac,
      serial: c.serial,
      os: c.os,
      manufacturer: c.cpu,
      model: c.cpu,
    }));

    console.log(`[Simulation] AD Scan - ${computers.length} poste(s) simulé(s)`);

    const stats = { created: 0, updated: 0, failed: 0 };

    for (const comp of computers) {
      try {
        const processed = await processComputer(comp);
        if (processed) {
          stats[processed.status === 'created' ? 'created' : 'updated']++;
        }
      } catch (err) {
        stats.failed++;
        console.error(`[Simulation] AD Scan - Erreur traitement ${comp.hostname} :`, err.message);
      }
    }

    const missingCount = await anomalyDetector.detectMissingDevices(3);
    const neverSeenCount = await anomalyDetector.detectNeverSeen(7);

    const durationMs = Date.now() - startTime;
    console.log(
      `[Simulation] AD Scan ✅ Terminé en ${durationMs}ms — ${stats.created} créés, ` +
      `${stats.updated} mis à jour, ${stats.failed} échecs, ` +
      `${missingCount} absents, ${neverSeenCount} jamais vus.`
    );

    return {
      ...stats,
      missing: missingCount,
      neverSeen: neverSeenCount,
      total: computers.length,
      online: computers.length,
      offline: 0,
      duration_ms: durationMs,
    };
  }

  // ── Mode production ──────────────────────────────────────────
  console.log('[Production] AD Scan - Exécution du script PowerShell');
  console.log('[ADScan] 🔍 Démarrage du scan Active Directory...');

  try {
    const result = await runPowerShellScan();
    const computers = result.computers || [];
    const summary = result.summary || {};

    console.log(`[ADScan] ${computers.length} poste(s) découvert(s) (${summary.online || 0} en ligne, ${summary.offline || 0} hors ligne)`);

    const stats = { created: 0, updated: 0, failed: 0 };

    // Traiter chaque poste séquentiellement (le parallélisme est géré côté PowerShell)
    for (const comp of computers) {
      try {
        const processed = await processComputer(comp);
        if (processed) {
          stats[processed.status === 'created' ? 'created' : 'updated']++;
        }
      } catch (err) {
        stats.failed++;
        console.error(`[ADScan] Erreur traitement ${comp.hostname} :`, err.message);
      }
    }

    // ── Détections globales après le scan ────────────────────
    const missingCount = await anomalyDetector.detectMissingDevices(3);
    const neverSeenCount = await anomalyDetector.detectNeverSeen(7);

    const durationMs = Date.now() - startTime;
    console.log(
      `[ADScan] ✅ Terminé en ${durationMs}ms — ${stats.created} créés, ` +
      `${stats.updated} mis à jour, ${stats.failed} échecs, ` +
      `${missingCount} absents, ${neverSeenCount} jamais vus.`
    );

    return {
      ...stats,
      missing: missingCount,
      neverSeen: neverSeenCount,
      total: computers.length,
      online: summary.online || 0,
      offline: summary.offline || 0,
      duration_ms: durationMs,
    };
  } catch (err) {
    console.error('[ADScan] ❌ Erreur globale :', err.message);
    return { error: err.message, duration_ms: Date.now() - startTime };
  }
}

export default { runADScan };