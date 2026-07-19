// backend/src/services/networkDiscovery/snmpScan.js
import snmp from 'net-snmp';
import pool from '../../db.js';
import { getSettings } from '../settingsService.js';
import { getFakeSNMPDevices } from '../mock/simulationService.js';

const OIDS = {
  description:  '1.3.6.1.2.1.1.1.0',
  serialNumber: '1.3.6.1.2.1.43.5.1.1.17.1',
};

function scanHost(ip) {
  return new Promise((resolve) => {
    const session = snmp.createSession(ip, 'public', { timeout: 1500, retries: 0 });
    session.get(Object.values(OIDS), (error, varbinds) => {
      session.close();
      if (error) return resolve(null);

      const result = { ip };
      varbinds.forEach((vb, i) => {
        const key = Object.keys(OIDS)[i];
        result[key] = snmp.isVarbindError(vb) ? null : vb.value.toString();
      });
      resolve(result.description ? result : null);
    });
  });
}

async function notifyAdmins(title, message, assetId) {
  const { rows: admins } = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'Admin' AND u.status = 'active'`
  );
  for (const admin of admins) {
    await pool.query(
      `INSERT INTO notifications (title, message, user_id, "read", asset_id)
       VALUES ($1,$2,$3,FALSE,$4)`,
      [title, message, admin.id, assetId]
    );
  }
}

async function processDevice(data) {
  const { ip, description, serialNumber } = data;

  const { rows } = await pool.query(
    `SELECT id FROM assets WHERE adresse_ip = $1 OR serial_number = $2 LIMIT 1`,
    [ip, serialNumber || null]
  );

  if (rows[0]) {
    await pool.query(
      `UPDATE assets SET adresse_ip = $1, last_seen_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [ip, rows[0].id]
    );
    return { ip, status: 'updated' };
  }

  const desc = (description || '').toLowerCase();
  const type = desc.includes('printer') || desc.includes('imprimante') ? 'Imprimante'
             : desc.includes('switch') ? 'Switch'
             : 'Équipement réseau';

  const assetTag = `NET-${ip.split('.').pop()}-${Date.now().toString().slice(-4)}`;

  try {
    const { rows: created } = await pool.query(
      `INSERT INTO assets
         (asset_tag, type, brand, model, status, adresse_ip,
          serial_number, location, last_seen_at, discovery_method)
       VALUES ($1,$2,$3,$3,'En service',$4,$5,'Détecté via scan SNMP',NOW(),'snmp_scan')
       RETURNING id`,
      [assetTag, type, description || 'Inconnu', ip, serialNumber || null]
    );

    await pool.query(
      `INSERT INTO asset_history (asset_id, action_type, action)
       VALUES ($1, 'created', 'Équipement détecté automatiquement via scan SNMP réseau')`,
      [created[0].id]
    );

    await notifyAdmins(
      '🆕 Équipement réseau détecté',
      `${type} "${assetTag}" (${ip}) ajouté automatiquement.`,
      created[0].id
    );

    return { ip, status: 'created' };
  } catch (err) {
    // ── Doublon détecté par la base (index unique sur serial_number ou adresse_mac) ──
    if (err.code === '23505') {
      console.warn(`[SNMPScan] Doublon évité pour ${ip} (SN: ${serialNumber}) — bascule en mise à jour.`);
      const { rows: existing } = await pool.query(
        `SELECT id FROM assets WHERE serial_number = $1 LIMIT 1`,
        [serialNumber]
      );
      if (existing[0]) {
        await pool.query(
          `UPDATE assets SET adresse_ip = $1, last_seen_at = NOW(), updated_at = NOW() WHERE id = $2`,
          [ip, existing[0].id]
        );
        return { ip, status: 'updated' };
      }
      return { ip, status: 'skipped' };
    }
    throw err;
  }
}

export async function runSNMPScan(baseIp, start = 1, end = 254) {
  const settings = getSettings();

  // Bug #6 fix: vérification stricte de simulation_mode pour éviter le cas où
  // la chaîne 'false' (valeur DB) serait évaluée comme truthy
  if (settings.simulation_mode === true || settings.simulation_mode === 'true') {
    console.log(`[Simulation] SNMP Scan — Récupération des équipements simulés...`);
    const devices = getFakeSNMPDevices();
    const results = { created: 0, updated: 0, scanned: devices.length, skipped: 0 };

    for (const device of devices) {
      const data = {
        ip: device.ip_address,
        description: `${device.vendor} ${device.model}`,
        serialNumber: device.serial,
      };
      const result = await processDevice(data);
      results[result.status] = (results[result.status] || 0) + 1;
    }

    console.log(`[Simulation] SNMP Scan ✅ Terminé — ${results.scanned} équipements traités, ${results.created} créés, ${results.updated} mis à jour, ${results.skipped} ignorés.`);
    return results;
  }

  console.log(`[Production] SNMP Scan 🔍 Scan de ${baseIp}.${start} à ${baseIp}.${end}...`);
  const results = { created: 0, updated: 0, scanned: 0, skipped: 0 };

  const batchSize = 20;
  for (let i = start; i <= end; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, end + 1); j++) {
      batch.push(`${baseIp}.${j}`);
    }
    const responses = await Promise.all(batch.map(scanHost));
    results.scanned += batch.length;

    for (const data of responses) {
      if (data) {
        const result = await processDevice(data);
        results[result.status] = (results[result.status] || 0) + 1;
      }
    }
  }

  console.log(`[Production] SNMP Scan ✅ Terminé — ${results.scanned} IP scannées, ${results.created} créés, ${results.updated} mis à jour, ${results.skipped} ignorés.`);
  return results;
}

export default { runSNMPScan };