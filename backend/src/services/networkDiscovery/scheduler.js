// backend/src/services/networkDiscovery/scheduler.js
import { runADScan } from './adScan.js';
import { runSNMPScan } from './snmpScan.js';
import { refreshAllLiveStates } from './digitalTwin.js';
import { detectPcPrinterRelations } from './relationDetector.js';
import { runAutoTicketingChecks } from '../autoTicketing/autoTicketEngine.js';
import { getSettings } from '../settingsService.js';

// Horodatage de la dernière exécution de chaque tâche, pour calculer si
// l'intervalle configuré est écoulé. Permet de réagir aux changements faits
// depuis Paramètres → Système sans redémarrer le serveur.
const lastRun = {
  adScan: 0,
  snmpScan: 0,
  liveState: 0,
  relations: 0,
  autoTicketing: 0,
};

// Vérifie toutes les minutes si une tâche doit s'exécuter, selon les
// paramètres actuels (rechargés à chaque tick via getSettings()).
const TICK_INTERVAL_MS = 60 * 1000;

function minutesSince(timestamp) {
  if (!timestamp) return Infinity;
  return (Date.now() - timestamp) / 60000;
}

async function tick() {
  const s = getSettings();

  if (s.enable_ad_scan && minutesSince(lastRun.adScan) >= s.ad_scan_interval_min) {
    lastRun.adScan = Date.now();
    console.log(`[Scheduler] Exécution du scan AD (intervalle ${s.ad_scan_interval_min} min)`);
    runADScan().catch((err) => console.error('[Scheduler] Erreur scan AD :', err.message));
  }

  if (s.enable_snmp_scan && minutesSince(lastRun.snmpScan) >= s.snmp_scan_interval_min) {
    lastRun.snmpScan = Date.now();
    console.log(`[Scheduler] Exécution du scan SNMP (intervalle ${s.snmp_scan_interval_min} min)`);
    runSNMPScan(s.snmp_network_base).catch((err) => console.error('[Scheduler] Erreur scan SNMP :', err.message));
  }

  if (s.enable_live_state && minutesSince(lastRun.liveState) >= s.live_state_interval_min) {
    lastRun.liveState = Date.now();
    console.log(`[Scheduler] Rafraîchissement Digital Twin (intervalle ${s.live_state_interval_min} min)`);
    refreshAllLiveStates().catch((err) => console.error('[Scheduler] Erreur Digital Twin :', err.message));
  }

  // La détection de relations tourne toujours, indépendamment des flags
  if (minutesSince(lastRun.relations) >= s.relation_interval_min) {
    lastRun.relations = Date.now();
    console.log(`[Scheduler] Détection de relations (intervalle ${s.relation_interval_min} min)`);
    detectPcPrinterRelations().catch((err) => console.error('[Scheduler] Erreur relations :', err.message));
  }

  if (s.enable_auto_ticketing && minutesSince(lastRun.autoTicketing) >= s.auto_ticket_interval_min) {
    lastRun.autoTicketing = Date.now();
    console.log(`[Scheduler] Vérifications auto-ticketing (intervalle ${s.auto_ticket_interval_min} min)`);
    runAutoTicketingChecks().catch((err) => console.error('[Scheduler] Erreur auto-ticketing :', err.message));
  }
}

export function startNetworkDiscovery() {
  console.log('[Scheduler] Démarrage de la boucle de supervision (vérification toutes les minutes)');

  // Premier passage immédiat au démarrage du serveur
  tick();

  // Puis vérification toutes les minutes : chaque tâche active se déclenche
  // dès que son intervalle configuré est écoulé, en lisant les paramètres
  // actuels (base de données ou .env en repli)
  setInterval(tick, TICK_INTERVAL_MS);
}

export default { startNetworkDiscovery };