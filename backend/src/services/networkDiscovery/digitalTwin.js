// backend/src/services/networkDiscovery/digitalTwin.js
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PS_SCRIPT = path.join(__dirname, 'get-live-state.ps1');

function runLiveStateScript(hostname) {
  return new Promise((resolve) => {
    const cmd = `powershell.exe -ExecutionPolicy Bypass -File "${PS_SCRIPT}" -ComputerName "${hostname}"`;
    exec(cmd, { maxBuffer: 1024 * 1024 * 5, timeout: 15000 }, (error, stdout) => {
      if (error) return resolve(null);
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(null);
      }
    });
  });
}

async function saveLiveState(assetId, data) {
  await pool.query(
    `INSERT INTO asset_live_state
       (asset_id, is_online, cpu_usage, ram_usage, ram_total_mb,
        disk_free_gb, disk_total_gb, uptime_hours, logged_in_user, last_checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (asset_id) DO UPDATE SET
       is_online       = EXCLUDED.is_online,
       cpu_usage       = EXCLUDED.cpu_usage,
       ram_usage       = EXCLUDED.ram_usage,
       ram_total_mb    = EXCLUDED.ram_total_mb,
       disk_free_gb    = EXCLUDED.disk_free_gb,
       disk_total_gb   = EXCLUDED.disk_total_gb,
       uptime_hours    = EXCLUDED.uptime_hours,
       logged_in_user  = EXCLUDED.logged_in_user,
       last_checked_at = NOW()`,
    [
      assetId, data.is_online, data.cpu_usage, data.ram_usage, data.ram_total_mb,
      data.disk_free_gb, data.disk_total_gb, data.uptime_hours, data.current_user,
    ]
  );
}

async function markOffline(assetId) {
  await pool.query(
    `INSERT INTO asset_live_state (asset_id, is_online, last_checked_at)
     VALUES ($1, FALSE, NOW())
     ON CONFLICT (asset_id) DO UPDATE SET
       is_online = FALSE, last_checked_at = NOW()`,
    [assetId]
  );
}

export async function refreshAllLiveStates() {
  console.log('[DigitalTwin] 🔄 Rafraîchissement des états en direct...');

  const { rows: computers } = await pool.query(
    `SELECT id, asset_tag, model AS hostname FROM assets
     WHERE type = 'Ordinateur' AND status != 'Retiré'`
  );

  let online = 0, offline = 0;

  for (const computer of computers) {
    const data = await runLiveStateScript(computer.model);
    if (data && !data.error) {
      await saveLiveState(computer.id, { ...data, is_online: true });
      online++;
    } else {
      await markOffline(computer.id);
      offline++;
    }
  }

  console.log(`[DigitalTwin] ✅ ${online} en ligne, ${offline} hors ligne (sur ${computers.length} postes).`);
  return { online, offline, total: computers.length };
}

export async function getAssetLiveProfile(assetId) {
  const { rows } = await pool.query(
    `SELECT * FROM asset_live_state WHERE asset_id = $1`, [assetId]
  );
  return rows[0] || null;
}

export default { refreshAllLiveStates, getAssetLiveProfile };