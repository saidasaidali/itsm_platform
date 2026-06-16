// backend/src/services/networkDiscovery/scheduler.js
// Planifie l'exécution périodique des scans réseau
import { runADScan } from './adScan.js';
import { runSNMPScan } from './snmpScan.js';

const AD_SCAN_INTERVAL    = parseInt(process.env.AD_SCAN_INTERVAL_MIN    || '60')  * 60 * 1000;
const SNMP_SCAN_INTERVAL  = parseInt(process.env.SNMP_SCAN_INTERVAL_MIN  || '120') * 60 * 1000;
const SNMP_NETWORK_BASE   = process.env.SNMP_NETWORK_BASE || '192.168.25';
const ENABLE_AD_SCAN      = process.env.ENABLE_AD_SCAN   === 'true';
const ENABLE_SNMP_SCAN    = process.env.ENABLE_SNMP_SCAN === 'true';

export function startNetworkDiscovery() {
  if (ENABLE_AD_SCAN) {
    console.log(`[Scheduler] Scan AD activé — toutes les ${AD_SCAN_INTERVAL / 60000} min`);
    runADScan(); // exécution immédiate au démarrage
    setInterval(runADScan, AD_SCAN_INTERVAL);
  } else {
    console.log('[Scheduler] Scan AD désactivé (ENABLE_AD_SCAN=false)');
  }

  if (ENABLE_SNMP_SCAN) {
    console.log(`[Scheduler] Scan SNMP activé — toutes les ${SNMP_SCAN_INTERVAL / 60000} min sur ${SNMP_NETWORK_BASE}.x`);
    runSNMPScan(SNMP_NETWORK_BASE);
    setInterval(() => runSNMPScan(SNMP_NETWORK_BASE), SNMP_SCAN_INTERVAL);
  } else {
    console.log('[Scheduler] Scan SNMP désactivé (ENABLE_SNMP_SCAN=false)');
  }
}

export default { startNetworkDiscovery };