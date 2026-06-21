// backend/src/services/settingsService.js
import pool from '../db.js';

let cache = null;

// ─── Charge tous les paramètres depuis la base, avec repli sur process.env ────
export async function loadSettings() {
  try {
    const { rows } = await pool.query(`SELECT setting_key, setting_value FROM system_settings`);
    const fromDb = {};
    rows.forEach((r) => { fromDb[r.setting_key] = r.setting_value; });

    cache = {
      smtp_host: fromDb.smtp_host || process.env.SMTP_HOST || '',
      smtp_port: fromDb.smtp_port || process.env.SMTP_PORT || '587',
      smtp_user: fromDb.smtp_user || process.env.SMTP_USER || '',
      smtp_pass: fromDb.smtp_pass || process.env.SMTP_PASS || '',
      smtp_from: fromDb.smtp_from || process.env.SMTP_FROM || '',

      enable_ad_scan:           toBool(fromDb.enable_ad_scan,           process.env.ENABLE_AD_SCAN),
      enable_snmp_scan:         toBool(fromDb.enable_snmp_scan,         process.env.ENABLE_SNMP_SCAN),
      enable_live_state:        toBool(fromDb.enable_live_state,        process.env.ENABLE_LIVE_STATE),
      enable_auto_ticketing:    toBool(fromDb.enable_auto_ticketing,    process.env.ENABLE_AUTO_TICKETING),

      ad_scan_interval_min:        Number(fromDb.ad_scan_interval_min        || process.env.AD_SCAN_INTERVAL_MIN        || 60),
      snmp_scan_interval_min:      Number(fromDb.snmp_scan_interval_min      || process.env.SNMP_SCAN_INTERVAL_MIN      || 120),
      snmp_network_base:           fromDb.snmp_network_base || process.env.SNMP_NETWORK_BASE || '',
      live_state_interval_min:     Number(fromDb.live_state_interval_min     || process.env.LIVE_STATE_INTERVAL_MIN     || 10),
      relation_interval_min:       Number(fromDb.relation_interval_min       || process.env.RELATION_INTERVAL_MIN       || 360),
      auto_ticket_interval_min:    Number(fromDb.auto_ticket_interval_min    || process.env.AUTO_TICKET_INTERVAL_MIN    || 30),
    };

    return cache;
  } catch (err) {
    console.error('[settingsService] Erreur de chargement, repli sur .env uniquement:', err.message);
    cache = buildEnvFallback();
    return cache;
  }
}

function toBool(dbValue, envValue) {
  if (dbValue !== undefined && dbValue !== null && dbValue !== '') {
    return dbValue === 'true';
  }
  return envValue === 'true';
}

function buildEnvFallback() {
  return {
    smtp_host: process.env.SMTP_HOST || '',
    smtp_port: process.env.SMTP_PORT || '587',
    smtp_user: process.env.SMTP_USER || '',
    smtp_pass: process.env.SMTP_PASS || '',
    smtp_from: process.env.SMTP_FROM || '',
    enable_ad_scan: process.env.ENABLE_AD_SCAN === 'true',
    enable_snmp_scan: process.env.ENABLE_SNMP_SCAN === 'true',
    enable_live_state: process.env.ENABLE_LIVE_STATE === 'true',
    enable_auto_ticketing: process.env.ENABLE_AUTO_TICKETING === 'true',
    ad_scan_interval_min: Number(process.env.AD_SCAN_INTERVAL_MIN || 60),
    snmp_scan_interval_min: Number(process.env.SNMP_SCAN_INTERVAL_MIN || 120),
    snmp_network_base: process.env.SNMP_NETWORK_BASE || '',
    live_state_interval_min: Number(process.env.LIVE_STATE_INTERVAL_MIN || 10),
    relation_interval_min: Number(process.env.RELATION_INTERVAL_MIN || 360),
    auto_ticket_interval_min: Number(process.env.AUTO_TICKET_INTERVAL_MIN || 30),
  };
}

// ─── Lecture rapide depuis le cache mémoire (chargé au démarrage) ─────────────
export function getSettings() {
  if (!cache) {
    console.warn('[settingsService] Paramètres non encore chargés, repli sur .env');
    return buildEnvFallback();
  }
  return cache;
}

// ─── Force un rechargement (appelé après modification depuis l'interface) ────
export async function reloadSettings() {
  return loadSettings();
}