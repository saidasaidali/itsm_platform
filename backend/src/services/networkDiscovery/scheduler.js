// backend/src/services/networkDiscovery/scheduler.js
import { runADScan } from './adScan.js';
import { runSNMPScan } from './snmpScan.js';
import { refreshAllLiveStates } from './digitalTwin.js';
import { detectPcPrinterRelations } from './relationDetector.js';
import { runAutoTicketingChecks } from '../autoTicketing/autoTicketEngine.js';

const AD_SCAN_INTERVAL       = parseInt(process.env.AD_SCAN_INTERVAL_MIN       || '60')  * 60 * 1000;
const SNMP_SCAN_INTERVAL     = parseInt(process.env.SNMP_SCAN_INTERVAL_MIN     || '120') * 60 * 1000;
const LIVE_STATE_INTERVAL    = parseInt(process.env.LIVE_STATE_INTERVAL_MIN    || '10')  * 60 * 1000;
const RELATION_INTERVAL      = parseInt(process.env.RELATION_INTERVAL_MIN      || '360') * 60 * 1000;
const AUTO_TICKET_INTERVAL   = parseInt(process.env.AUTO_TICKET_INTERVAL_MIN   || '30')  * 60 * 1000;

const SNMP_NETWORK_BASE = process.env.SNMP_NETWORK_BASE || '192.168.25';
const ENABLE_AD_SCAN       = process.env.ENABLE_AD_SCAN       === 'true';
const ENABLE_SNMP_SCAN     = process.env.ENABLE_SNMP_SCAN     === 'true';
const ENABLE_LIVE_STATE    = process.env.ENABLE_LIVE_STATE    === 'true';
const ENABLE_AUTO_TICKETING = process.env.ENABLE_AUTO_TICKETING === 'true';

export function startNetworkDiscovery() {
  if (ENABLE_AD_SCAN) {
    console.log(`[Scheduler] Scan AD activé — toutes les ${AD_SCAN_INTERVAL / 60000} min`);
    runADScan();
    setInterval(runADScan, AD_SCAN_INTERVAL);
  }

  if (ENABLE_SNMP_SCAN) {
    console.log(`[Scheduler] Scan SNMP activé — toutes les ${SNMP_SCAN_INTERVAL / 60000} min`);
    runSNMPScan(SNMP_NETWORK_BASE);
    setInterval(() => runSNMPScan(SNMP_NETWORK_BASE), SNMP_SCAN_INTERVAL);
  }

  if (ENABLE_LIVE_STATE) {
    console.log(`[Scheduler] Digital Twin activé — toutes les ${LIVE_STATE_INTERVAL / 60000} min`);
    refreshAllLiveStates();
    setInterval(refreshAllLiveStates, LIVE_STATE_INTERVAL);
  }

  console.log(`[Scheduler] Détection de relations — toutes les ${RELATION_INTERVAL / 60000} min`);
  detectPcPrinterRelations();
  setInterval(detectPcPrinterRelations, RELATION_INTERVAL);

  if (ENABLE_AUTO_TICKETING) {
    console.log(`[Scheduler] Auto-ticketing activé — toutes les ${AUTO_TICKET_INTERVAL / 60000} min`);
    runAutoTicketingChecks();
    setInterval(runAutoTicketingChecks, AUTO_TICKET_INTERVAL);
  }
}

export default { startNetworkDiscovery };