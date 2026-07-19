// backend/src/services/networkDiscovery/scheduler.js
// Ordonnanceur centralisé des tâches de supervision réseau
// Architecture centralisée : tout est exécuté depuis le serveur, sans agent sur les postes
//
// Chaque tâche est exécutée selon son intervalle configuré dans system_settings.
// Les paramètres sont rechargés dynamiquement à chaque tick via getSettings().

import { runADScan } from './adScan.js';
import { runSNMPScan } from './snmpScan.js';
import { refreshAllLiveStates } from './digitalTwin.js';
import { detectPcPrinterRelations } from './relationDetector.js';
import { runAutoTicketingChecks, checkMLRiskScores } from '../autoTicketing/autoTicketEngine.js';
import { getSettings } from '../settingsService.js';
import { runAutoClose } from '../autoTicketing/autoCloseEngine.js';

// ─── État interne ──────────────────────────────────────────────────────────────

/** Horodatage de la dernière exécution de chaque tâche */
const lastRun = {
  adScan: 0,
  snmpScan: 0,
  liveState: 0,
  relations: 0,
  autoTicketing: 0,
  autoClose: 0,
};

/** Indique si une tâche est actuellement en cours d'exécution (empêche les chevauchements) */
const running = {
  adScan: false,
  snmpScan: false,
  liveState: false,
  relations: false,
  autoTicketing: false,
  autoClose: false,
};

/** Intervalle de vérification du scheduler (1 minute) */
const TICK_INTERVAL_MS = 60 * 1000;

/** Intervalle d'auto-clôture (24h) */
const AUTO_CLOSE_INTERVAL_MIN = 24 * 60;

// ─── Fonctions utilitaires ─────────────────────────────────────────────────────

/**
 * Calcule le nombre de minutes écoulées depuis un timestamp
 * @param {number} timestamp - Timestamp en ms
 * @returns {number} Minutes écoulées
 */
function minutesSince(timestamp) {
  if (!timestamp) return Infinity;
  return (Date.now() - timestamp) / 60000;
}

/**
 * Exécute une tâche avec protection contre les chevauchements et journalisation
 * @param {string} taskName - Nom de la tâche (pour les logs)
 * @param {string} stateKey - Clé dans l'objet running
 * @param {Function} taskFn - Fonction asynchrone à exécuter
 * @param {string} logMessage - Message de début
 */
async function runTask(taskName, stateKey, taskFn, logMessage) {
  if (running[stateKey]) {
    console.log(`[Scheduler] ⚠️ ${taskName} déjà en cours — exécution ignorée`);
    return;
  }

  running[stateKey] = true;
  const startTime = Date.now();
  console.log(`[Scheduler] ▶️ ${logMessage}`);

  try {
    const result = await taskFn();
    const durationMs = Date.now() - startTime;

    // Journalisation enrichie selon le type de tâche
    if (result && typeof result === 'object') {
      const details = [];
      if (result.total !== undefined) details.push(`total: ${result.total}`);
      if (result.online !== undefined) details.push(`en ligne: ${result.online}`);
      if (result.offline !== undefined) details.push(`hors ligne: ${result.offline}`);
      if (result.created !== undefined) details.push(`créés: ${result.created}`);
      if (result.updated !== undefined) details.push(`mis à jour: ${result.updated}`);
      if (result.failed !== undefined) details.push(`échecs: ${result.failed}`);
      if (result.errors !== undefined) details.push(`erreurs: ${result.errors}`);
      if (result.missing !== undefined) details.push(`absents: ${result.missing}`);
      if (result.computersFound !== undefined) details.push(`PC: ${result.computersFound}`);
      if (result.printersFound !== undefined) details.push(`Imprimantes: ${result.printersFound}`);
      if (result.relationsCreated !== undefined) details.push(`relations créées: ${result.relationsCreated}`);
      if (result.relationsExisting !== undefined) details.push(`relations existantes: ${result.relationsExisting}`);
      if (result.relationsIgnored !== undefined) details.push(`relations ignorées: ${result.relationsIgnored}`);

      console.log(
        `[Scheduler] ✅ ${taskName} terminé en ${durationMs}ms` +
        (details.length > 0 ? ` (${details.join(', ')})` : '')
      );
    } else {
      console.log(`[Scheduler] ✅ ${taskName} terminé en ${durationMs}ms`);
    }

    return result;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error(`[Scheduler] ❌ ${taskName} échoué après ${durationMs}ms :`, err.message);
  } finally {
    running[stateKey] = false;
  }
}

// ─── Boucle principale ─────────────────────────────────────────────────────────

/**
 * Vérifie et exécute les tâches dont l'intervalle est écoulé
 * Appelée périodiquement par le tick
 */
async function tick() {
  const s = getSettings();

  // ── Scan AD ────────────────────────────────────────────────
  if (s.enable_ad_scan && minutesSince(lastRun.adScan) >= s.ad_scan_interval_min) {
    lastRun.adScan = Date.now();
    await runTask(
      'Scan AD', 'adScan',
      () => runADScan(),
      `Exécution du scan AD (intervalle ${s.ad_scan_interval_min} min)`
    );
  }

  // ── Scan SNMP ──────────────────────────────────────────────
  if (s.enable_snmp_scan && minutesSince(lastRun.snmpScan) >= s.snmp_scan_interval_min) {
    lastRun.snmpScan = Date.now();
    await runTask(
      'Scan SNMP', 'snmpScan',
      () => runSNMPScan(s.snmp_network_base),
      `Exécution du scan SNMP (intervalle ${s.snmp_scan_interval_min} min)`
    );
  }

  // ── Digital Twin (Live State) ──────────────────────────────
  if (s.enable_live_state && minutesSince(lastRun.liveState) >= s.live_state_interval_min) {
    lastRun.liveState = Date.now();
    await runTask(
      'Digital Twin', 'liveState',
      () => refreshAllLiveStates(),
      `Rafraîchissement Digital Twin (intervalle ${s.live_state_interval_min} min)`
    );
  }

  // ── Détection de relations ─────────────────────────────────
  if (minutesSince(lastRun.relations) >= s.relation_interval_min) {
    lastRun.relations = Date.now();
    await runTask(
      'Relations', 'relations',
      () => detectPcPrinterRelations(),
      `Détection de relations (intervalle ${s.relation_interval_min} min)`
    );
  }

  // ── Auto-ticketing ─────────────────────────────────────────
  if (s.enable_auto_ticketing && minutesSince(lastRun.autoTicketing) >= s.auto_ticket_interval_min) {
    lastRun.autoTicketing = Date.now();
    await runTask(
      'Auto-Ticketing', 'autoTicketing',
      () => runAutoTicketingChecks(),
      `Vérifications auto-ticketing (intervalle ${s.auto_ticket_interval_min} min)`
    );
  }

  // ── Auto-clôture (quotidienne) ─────────────────────────────
  if (minutesSince(lastRun.autoClose) >= AUTO_CLOSE_INTERVAL_MIN) {
    lastRun.autoClose = Date.now();
    await runTask(
      'Auto-Clôture', 'autoClose',
      () => runAutoClose(),
      'Vérification auto-clôture des tickets résolus'
    );
  }
}

// ─── Démarrage ─────────────────────────────────────────────────────────────────

/**
 * Démarre la boucle de supervision
 * Le premier passage est immédiat au démarrage du serveur
 */
export function startNetworkDiscovery() {
  console.log('[Scheduler] 🚀 Démarrage de la boucle de supervision (vérification toutes les minutes)');

  // Premier passage immédiat au démarrage du serveur
  tick().catch((err) => {
    console.error('[Scheduler] Erreur lors du premier tick :', err.message);
  });

  // Puis vérification toutes les minutes
  setInterval(() => {
    tick().catch((err) => {
      console.error('[Scheduler] Erreur lors du tick :', err.message);
    });
  }, TICK_INTERVAL_MS);
}

export default { startNetworkDiscovery };