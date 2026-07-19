// backend/src/services/networkDiscovery/digitalTwin.js
// Digital Twin — récupère l'état en direct des postes via PowerShell/WMI
// Architecture centralisée : tout est exécuté depuis le serveur, sans agent sur les postes

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../../db.js';
import { getSettings } from '../settingsService.js';
import { getDigitalTwinLiveStates } from '../mock/simulationService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PS_SCRIPT = path.join(__dirname, 'get-live-state.ps1');

// ─── Cache mémoire pour la gestion Offline intelligente ─────────────────────────
// Évite de marquer Offline un équipement après une seule erreur temporaire
// Un poste n'est marqué Offline qu'après 3 échecs consécutifs
const failureCache = new Map();
const OFFLINE_THRESHOLD = 3;

/**
 * Décide si un asset doit être marqué Offline
 * @param {number} assetId
 * @returns {boolean} true si le seuil d'échecs est atteint
 */
function shouldMarkOffline(assetId) {
  const entry = failureCache.get(assetId) || 0;
  const newCount = entry + 1;
  failureCache.set(assetId, newCount);
  return newCount >= OFFLINE_THRESHOLD;
}

/**
 * Réinitialise le compteur d'échecs (appelé quand le poste répond)
 * @param {number} assetId
 */
function resetFailureCounter(assetId) {
  failureCache.delete(assetId);
}

/**
 * Exécute le script PowerShell get-live-state.ps1 pour un poste distant
 * Utilise les paramètres configurables depuis system_settings
 * @param {string} hostname - Nom du poste à interroger
 * @returns {Promise<Object|null>} Données du poste ou null si hors ligne
 */
function runLiveStateScript(hostname) {
  return new Promise((resolve) => {
    const s = getSettings();

    const timeoutSec = s.wmi_timeout_sec || 10;
    const retryCount = s.wmi_retry_count || 1;
    const retryDelay = s.wmi_retry_delay_sec || 2;
    const verbose = s.wmi_verbose_logging === true || s.wmi_verbose_logging === 'true';

    // Construire la commande avec les paramètres configurables
    const cmd =
      `powershell.exe -ExecutionPolicy Bypass -File "${PS_SCRIPT}" ` +
      `-ComputerName "${hostname}" ` +
      `-TimeoutSec ${timeoutSec} ` +
      `-RetryCount ${retryCount} ` +
      `-RetryDelaySec ${retryDelay}` +
      (verbose ? ' -VerboseLogging' : '');

    // Timeout global : timeout CIM * tentatives + marge de sécurité
    const globalTimeout = (timeoutSec * retryCount * 2 + 5) * 1000;
    const startTime = Date.now();

    exec(cmd, { maxBuffer: 1024 * 1024 * 5, timeout: globalTimeout }, (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;

      // Logger les détails de l'exécution (même en cas de succès)
      if (verbose || error) {
        const exitCode = error ? (error.code || error.status || 'N/A') : 0;
        const signal = error ? (error.signal || 'none') : 'none';
        console.log(
          `[DigitalTwin] ${hostname} terminé en ${durationMs}ms ` +
          `(code=${exitCode}, signal=${signal})`
        );
        if (stderr && stderr.trim()) {
          console.log(`[DigitalTwin] ${hostname} stderr: ${stderr.trim().slice(0, 500)}`);
        }
      }

      // Même en cas d'erreur (exit 1), le script PowerShell écrit du JSON valide dans stdout
      // avant de faire exit 1. On essaie de le parser dans tous les cas.
      if (stdout && stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout);
          // Vérifier si le script a retourné une erreur explicite
          if (parsed && parsed.error) {
            if (verbose) {
              console.log(`[DigitalTwin] ${hostname} : ${parsed.error}`);
            }
            return resolve(null);
          }
          // Succès : le script a retourné des données valides
          return resolve(parsed);
        } catch (parseErr) {
          // stdout n'est pas du JSON valide
          if (verbose) {
            console.log(`[DigitalTwin] ${hostname} : sortie JSON invalide: ${stdout.trim().slice(0, 200)}`);
          }
          return resolve(null);
        }
      }

      // Aucune sortie du tout
      if (error) {
        if (verbose) {
          console.log(`[DigitalTwin] ${hostname} : ${error.message}`);
        }
      }
      resolve(null);
    });
  });
}

/**
 * Sauvegarde l'état en direct d'un asset dans asset_live_state
 * Gère les nouveaux champs enrichis sans casser la rétrocompatibilité
 * @param {number} assetId - ID de l'asset
 * @param {Object} data - Données récupérées
 */
async function saveLiveState(assetId, data) {
  // Champs de base (rétrocompatibles)
  const isOnline = data.is_online === true || data.is_online === 'true';
  const cpuUsage = data.cpu_usage != null ? data.cpu_usage : null;
  const ramUsage = data.ram_usage != null ? data.ram_usage : null;
  const ramTotalMB = data.ram_total_mb != null ? data.ram_total_mb : null;
  const diskFreeGB = data.disk_free_gb != null ? data.disk_free_gb : null;
  const diskTotalGB = data.disk_total_gb != null ? data.disk_total_gb : null;
  const uptimeHours = data.uptime_hours != null ? data.uptime_hours : null;
  const loggedInUser = data.current_user || data.logged_in_user || null;

  // Nouveaux champs enrichis
  const manufacturer = data.manufacturer || null;
  const model = data.model || null;
  const serialNumber = data.serial_number || null;
  const biosManufacturer = data.bios_manufacturer || null;
  const biosVersion = data.bios_version || null;
  const windowsVersion = data.windows_version || null;
  const windowsBuild = data.windows_build || null;
  const architecture = data.architecture || null;
  const cpuCount = data.cpu_count != null ? data.cpu_count : null;
  const cpuFrequency = data.cpu_frequency_mhz != null ? data.cpu_frequency_mhz : null;
  const ramTotalGB = data.ram_total_gb != null ? data.ram_total_gb : null;
  const ipAddress = data.ip_address || null;
  const macAddress = data.mac_address || null;
  const firewallEnabled = data.firewall_enabled;
  const defenderEnabled = data.defender_enabled;
  const defenderStatus = data.defender_status;

  // Informations disques (JSON)
  const disks = data.disks ? JSON.stringify(data.disks) : null;

  await pool.query(
    `INSERT INTO asset_live_state
       (asset_id, is_online, cpu_usage, ram_usage, ram_total_mb,
        disk_free_gb, disk_total_gb, uptime_hours, logged_in_user,
        manufacturer, model, serial_number, bios_manufacturer, bios_version,
        windows_version, windows_build, architecture,
        cpu_count, cpu_frequency_mhz, ram_total_gb,
        ip_address, mac_address, firewall_enabled, defender_enabled, defender_status,
        disks_json, last_checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,NOW())
     ON CONFLICT (asset_id) DO UPDATE SET
       is_online          = EXCLUDED.is_online,
       cpu_usage          = EXCLUDED.cpu_usage,
       ram_usage          = EXCLUDED.ram_usage,
       ram_total_mb       = EXCLUDED.ram_total_mb,
       disk_free_gb       = EXCLUDED.disk_free_gb,
       disk_total_gb      = EXCLUDED.disk_total_gb,
       uptime_hours       = EXCLUDED.uptime_hours,
       logged_in_user     = EXCLUDED.logged_in_user,
       manufacturer       = EXCLUDED.manufacturer,
       model              = EXCLUDED.model,
       serial_number      = EXCLUDED.serial_number,
       bios_manufacturer  = EXCLUDED.bios_manufacturer,
       bios_version       = EXCLUDED.bios_version,
       windows_version    = EXCLUDED.windows_version,
       windows_build      = EXCLUDED.windows_build,
       architecture       = EXCLUDED.architecture,
       cpu_count          = EXCLUDED.cpu_count,
       cpu_frequency_mhz  = EXCLUDED.cpu_frequency_mhz,
       ram_total_gb       = EXCLUDED.ram_total_gb,
       ip_address         = EXCLUDED.ip_address,
       mac_address        = EXCLUDED.mac_address,
       firewall_enabled   = EXCLUDED.firewall_enabled,
       defender_enabled   = EXCLUDED.defender_enabled,
       defender_status    = EXCLUDED.defender_status,
       disks_json         = EXCLUDED.disks_json,
       last_checked_at    = NOW()`,
    [
      assetId, isOnline, cpuUsage, ramUsage, ramTotalMB,
      diskFreeGB, diskTotalGB, uptimeHours, loggedInUser,
      manufacturer, model, serialNumber, biosManufacturer, biosVersion,
      windowsVersion, windowsBuild, architecture,
      cpuCount, cpuFrequency, ramTotalGB,
      ipAddress, macAddress, firewallEnabled, defenderEnabled, defenderStatus,
      disks,
    ]
  );
}

/**
 * Marque un asset comme hors ligne
 * @param {number} assetId - ID de l'asset
 */
async function markOffline(assetId) {
  await pool.query(
    `INSERT INTO asset_live_state (asset_id, is_online, last_checked_at)
     VALUES ($1, FALSE, NOW())
     ON CONFLICT (asset_id) DO UPDATE SET
       is_online = FALSE, last_checked_at = NOW()`,
    [assetId]
  );
}

/**
 * Traite un lot de postes avec une limite de concurrence
 * @param {Array} computers - Liste des postes à interroger
 * @param {number} concurrency - Nombre max de requêtes parallèles
 * @returns {Promise<Object>} Statistiques du scan
 */
async function processBatchWithConcurrency(computers, concurrency) {
  const results = { online: 0, offline: 0, errors: 0 };
  const queue = [...computers];
  const active = new Set();

  const processNext = async () => {
    while (queue.length > 0) {
      const computer = queue.shift();
      // Résolution du nom DNS : priorité au vrai hostname, fallback sur l'IP
      // Ne PAS utiliser model (modèle matériel) ou asset_tag (PC-00123) comme nom DNS
      const hostname = computer.hostname || computer.adresse_ip || null;
      if (!hostname) {
        results.errors++;
        console.warn(`[DigitalTwin] Asset #${computer.id}: aucun hostname DNS ni adresse IP (asset_tag="${computer.asset_tag}")`);
        continue;
      }

      try {
        const data = await runLiveStateScript(hostname);
        if (data && data.is_online) {
          // Succès : reset du compteur d'échecs, sauvegarde du nouvel état
          resetFailureCounter(computer.id);
          await saveLiveState(computer.id, { ...data, is_online: true });
          results.online++;
        } else {
          // Échec : politique de tolérance avant de marquer Offline
          if (shouldMarkOffline(computer.id)) {
            await markOffline(computer.id);
            results.offline++;
          } else {
            results.errors++;
          }
        }
      } catch (err) {
        results.errors++;
        console.error(`[DigitalTwin] Erreur ${hostname} :`, err.message);
        // Politique de tolérance aussi pour les exceptions
        if (shouldMarkOffline(computer.id)) {
          await markOffline(computer.id);
          results.offline++;
        }
      }
    }
  };

  // Démarrer N workers en parallèle
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, computers.length); i++) {
    workers.push(processNext());
  }
  await Promise.all(workers);

  return results;
}

/**
 * Rafraîchit l'état en direct de tous les postes (Digital Twin)
 * Utilise une limite de concurrence configurable
 * @returns {Promise<Object>} Statistiques du scan
 */
export async function refreshAllLiveStates() {
  const s = getSettings();
  const startTime = Date.now();
  const verbose = s.wmi_verbose_logging === true || s.wmi_verbose_logging === 'true';

  // ── Mode Simulation ──────────────────────────────────────────
  if (s.simulation_mode === true || s.simulation_mode === 'true') {
    console.log(`[Simulation] Digital Twin - Génération des états simulés...`);

    // Récupérer les assets depuis la base pour avoir leurs IDs
    const { rows: computers } = await pool.query(
      `SELECT id, asset_tag, hostname, model, adresse_ip FROM assets
       WHERE type = 'Ordinateur' AND status != 'Retiré'`
    );

    if (computers.length === 0) {
      console.log('[Simulation] Digital Twin - Aucun poste à simuler.');
      return { online: 0, offline: 0, total: 0, duration_ms: 0 };
    }

    // Construire un index hostname → asset pour retrouver les IDs
    const simulatedStates = getDigitalTwinLiveStates();
    const assetByHostname = {};
    for (const computer of computers) {
      // Indexer par hostname (s'il existe)
      if (computer.hostname) {
        const key = computer.hostname.trim().toLowerCase();
        assetByHostname[key] = computer;
      }
      // Indexer par asset_tag (peut être PC-USER-001 ou PC-PC-USER-001)
      if (computer.asset_tag) {
        const tagKey = computer.asset_tag.trim().toLowerCase();
        assetByHostname[tagKey] = computer;
        // Essayer sans le préfixe PC- (au cas où asset_tag = PC-PC-USER-001)
        const sansPc = tagKey.replace(/^pc[\s-]*/i, '');
        if (sansPc !== tagKey && !assetByHostname[sansPc]) {
          assetByHostname[sansPc] = computer;
        }
      }
    }

    console.log(`[Simulation] Index construit avec ${Object.keys(assetByHostname).length} entrées`);
    console.log(`[Simulation] Exemples d'index: ${Object.keys(assetByHostname).slice(0, 5).join(', ')}...`);
    console.log(`[Simulation] Exemples simulés: ${simulatedStates.slice(0, 3).map(s => s.hostname).join(', ')}...`);

    console.log(`[Simulation] ${simulatedStates.length} poste(s) simulé(s) pour ${computers.length} asset(s)`);
    const results = { online: 0, offline: 0, errors: 0, saved: 0, skipped: 0 };

    for (const state of simulatedStates) {
      if (!state) continue;

      // Trouver l'asset correspondant par hostname
      const stateHostname = (state.hostname || '').toLowerCase();
      const asset = assetByHostname[stateHostname];

      if (!asset) {
        // Hostname simulé non trouvé dans la base (ex: PC-USER-006 mais pas dans assets)
        results.skipped++;
        continue;
      }

      if (state.is_online) {
        try {
          await saveLiveState(asset.id, state);
          results.online++;
          results.saved++;
        } catch (err) {
          console.error(`[Simulation] Erreur sauvegarde ${state.hostname} (asset #${asset.id}):`, err.message);
          results.errors++;
        }
      } else {
        await markOffline(asset.id);
        results.offline++;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[Simulation] Digital Twin terminé — ${results.online} en ligne, ` +
      `${results.offline} hors ligne, ${results.errors} erreurs, ` +
      `${results.skipped} ignorés (${durationMs}ms)`
    );
    return {
      online: results.online,
      offline: results.offline,
      total: simulatedStates.length,
      errors: results.errors,
      duration_ms: durationMs,
    };
  }

  // ── Mode Production (PowerShell/WMI) ────────────────────────
  const concurrency = s.wmi_max_parallel || 10;

  console.log(`[DigitalTwin] 🔄 Rafraîchissement des états en direct (${concurrency} requêtes parallèles max)...`);

  const { rows: computers } = await pool.query(
    `SELECT id, asset_tag, hostname, model, adresse_ip FROM assets
     WHERE type = 'Ordinateur' AND status != 'Retiré'`
  );

  if (computers.length === 0) {
    console.log('[DigitalTwin] Aucun poste à interroger.');
    return { online: 0, offline: 0, total: 0, duration_ms: 0 };
  }

  console.log(`[DigitalTwin] ${computers.length} poste(s) à interroger`);

  const stats = await processBatchWithConcurrency(computers, concurrency);

  const durationMs = Date.now() - startTime;
  console.log(
    `[DigitalTwin] ✅ ${stats.online} en ligne, ${stats.offline} hors ligne, ` +
    `${stats.errors} erreur(s) (sur ${computers.length} postes) — ${durationMs}ms`
  );

  return {
    online: stats.online,
    offline: stats.offline,
    total: computers.length,
    errors: stats.errors,
    duration_ms: durationMs,
  };
}

/**
 * Récupère le profil en direct d'un asset spécifique
 * @param {number} assetId - ID de l'asset
 * @returns {Promise<Object|null>} Données live ou null
 */
export async function getAssetLiveProfile(assetId) {
  const { rows } = await pool.query(
    `SELECT * FROM asset_live_state WHERE asset_id = $1`, [assetId]
  );
  return rows[0] || null;
}

export default { refreshAllLiveStates, getAssetLiveProfile };