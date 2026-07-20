// backend/src/services/settingsService.js
import pool from '../db.js';
import EventEmitter from 'events';

let cache = null;
export const settingsEmitter = new EventEmitter();

// ─── Charge tous les paramètres depuis la base, avec repli sur process.env ────
export async function loadSettings() {
  try {
    const { rows } = await pool.query(`SELECT setting_key, setting_value FROM system_settings`);
    const fromDb = {};
    rows.forEach((r) => { fromDb[r.setting_key] = r.setting_value; });

    cache = {
      // SMTP
      smtp_host: fromDb.smtp_host || process.env.SMTP_HOST || '',
      smtp_port: fromDb.smtp_port || process.env.SMTP_PORT || '587',
      smtp_user: fromDb.smtp_user || process.env.SMTP_USER || '',
      smtp_pass: fromDb.smtp_pass || process.env.SMTP_PASS || '',
      smtp_from: fromDb.smtp_from || process.env.SMTP_FROM || '',

      // Feature toggles
      enable_ad_scan:           toBool(fromDb.enable_ad_scan,           process.env.ENABLE_AD_SCAN),
      enable_snmp_scan:         toBool(fromDb.enable_snmp_scan,         process.env.ENABLE_SNMP_SCAN),
      enable_live_state:        toBool(fromDb.enable_live_state,        process.env.ENABLE_LIVE_STATE),
      enable_auto_ticketing:    toBool(fromDb.enable_auto_ticketing,    process.env.ENABLE_AUTO_TICKETING),

      // Simulation / Mock Mode
      // @mode simulation - Quand activé, retourne des données simulées au lieu d'appeler les services réels
      simulation_mode:          toBool(fromDb.simulation_mode,          process.env.SIMULATION_MODE),

      // Intervals
      ad_scan_interval_min:        Number(fromDb.ad_scan_interval_min        || process.env.AD_SCAN_INTERVAL_MIN        || 60),
      snmp_scan_interval_min:      Number(fromDb.snmp_scan_interval_min      || process.env.SNMP_SCAN_INTERVAL_MIN      || 120),
      snmp_network_base:           fromDb.snmp_network_base || process.env.SNMP_NETWORK_BASE || '',
      live_state_interval_min:     Number(fromDb.live_state_interval_min     || process.env.LIVE_STATE_INTERVAL_MIN     || 10),
      relation_interval_min:       Number(fromDb.relation_interval_min       || process.env.RELATION_INTERVAL_MIN       || 360),
      auto_ticket_interval_min:    Number(fromDb.auto_ticket_interval_min    || process.env.AUTO_TICKET_INTERVAL_MIN    || 30),

       // Auto-Ticketing thresholds
       auto_ticket_cooldown_hours:  Number(fromDb.auto_ticket_cooldown_hours  || process.env.AUTO_TICKET_COOLDOWN_HOURS  || 24),
       auto_ticket_pc_missing_days: Number(fromDb.auto_ticket_pc_missing_days || process.env.AUTO_TICKET_PC_MISSING_DAYS || 3),
       auto_ticket_disk_full_gb:    Number(fromDb.auto_ticket_disk_full_gb    || process.env.AUTO_TICKET_DISK_FULL_GB    || 5),
       auto_ticket_printer_offline_hours: Number(fromDb.auto_ticket_printer_offline_hours || process.env.AUTO_TICKET_PRINTER_OFFLINE_HOURS || 2),
       auto_ticket_offline_hours:   Number(fromDb.auto_ticket_offline_hours   || process.env.AUTO_TICKET_OFFLINE_HOURS   || 1),

      // App / Frontend
      frontend_url: fromDb.frontend_url || process.env.FRONTEND_URL || '',
      cors_origin:  fromDb.cors_origin  || process.env.CORS_ORIGIN || 'http://localhost:3001',

      // External services
      ml_service_url: fromDb.ml_service_url || process.env.ML_SERVICE_URL || 'http://localhost:8001',
      ml_service_port: Number(fromDb.ml_service_port || process.env.ML_SERVICE_PORT || 8001),
      ollama_url: fromDb.ollama_url || process.env.OLLAMA_URL || 'http://localhost:11434',
      ollama_model: fromDb.ollama_model || process.env.OLLAMA_MODEL || 'llama3.2',

      // WMI / Network Discovery settings
      wmi_timeout_sec:        Number(fromDb.wmi_timeout_sec        || process.env.WMI_TIMEOUT_SEC        || 10),
      wmi_max_parallel:       Number(fromDb.wmi_max_parallel       || process.env.WMI_MAX_PARALLEL       || 32),
      wmi_retry_count:        Number(fromDb.wmi_retry_count        || process.env.WMI_RETRY_COUNT        || 1),
      wmi_retry_delay_sec:    Number(fromDb.wmi_retry_delay_sec    || process.env.WMI_RETRY_DELAY_SEC    || 2),
      wmi_verbose_logging:    toBool(fromDb.wmi_verbose_logging,   process.env.WMI_VERBOSE_LOGGING),

      // Agent / keys
      asset_agent_key: fromDb.asset_agent_key || process.env.ASSET_AGENT_KEY || '',
    };

    // Emettre un événement pour notifier les consommateurs si besoin
    settingsEmitter.emit('reloaded', cache);

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

function validateSettings(settings) {
  const errors = {};
  
  // SMTP validation
  if (settings.smtp_port && (isNaN(settings.smtp_port) || settings.smtp_port < 1 || settings.smtp_port > 65535)) {
    errors.smtp_port = 'Port SMTP invalide (doit être entre 1 et 65535)';
  }
  if (settings.smtp_user && !settings.smtp_user.includes('@')) {
    errors.smtp_user = 'Email SMTP invalide';
  }
  
  // Intervals validation
  if (settings.ad_scan_interval_min && (isNaN(settings.ad_scan_interval_min) || settings.ad_scan_interval_min < 1)) {
    errors.ad_scan_interval_min = 'Intervalle doit être ≥ 1 minute';
  }
  if (settings.snmp_scan_interval_min && (isNaN(settings.snmp_scan_interval_min) || settings.snmp_scan_interval_min < 1)) {
    errors.snmp_scan_interval_min = 'Intervalle doit être ≥ 1 minute';
  }
  if (settings.live_state_interval_min && (isNaN(settings.live_state_interval_min) || settings.live_state_interval_min < 1)) {
    errors.live_state_interval_min = 'Intervalle doit être ≥ 1 minute';
  }
  if (settings.relation_interval_min && (isNaN(settings.relation_interval_min) || settings.relation_interval_min < 1)) {
    errors.relation_interval_min = 'Intervalle doit être ≥ 1 minute';
  }
  if (settings.auto_ticket_interval_min && (isNaN(settings.auto_ticket_interval_min) || settings.auto_ticket_interval_min < 1)) {
    errors.auto_ticket_interval_min = 'Intervalle doit être ≥ 1 minute';
  }
  
  // Auto-ticketing thresholds validation
  if (settings.auto_ticket_cooldown_hours && (isNaN(settings.auto_ticket_cooldown_hours) || settings.auto_ticket_cooldown_hours < 1)) {
    errors.auto_ticket_cooldown_hours = 'Cooldown doit être ≥ 1 heure';
  }
  if (settings.auto_ticket_pc_missing_days && (isNaN(settings.auto_ticket_pc_missing_days) || settings.auto_ticket_pc_missing_days < 1)) {
    errors.auto_ticket_pc_missing_days = 'Seuil doit être ≥ 1 jour';
  }
  if (settings.auto_ticket_disk_full_gb && (isNaN(settings.auto_ticket_disk_full_gb) || settings.auto_ticket_disk_full_gb < 0)) {
    errors.auto_ticket_disk_full_gb = 'Seuil doit être ≥ 0 GB';
  }
  if (settings.auto_ticket_printer_offline_hours && (isNaN(settings.auto_ticket_printer_offline_hours) || settings.auto_ticket_printer_offline_hours < 1)) {
    errors.auto_ticket_printer_offline_hours = 'Seuil doit être ≥ 1 heure';
  }
  if (settings.auto_ticket_offline_hours && (isNaN(settings.auto_ticket_offline_hours) || settings.auto_ticket_offline_hours < 1)) {
    errors.auto_ticket_offline_hours = 'Seuil doit être ≥ 1 heure';
  }
  
  // URL validation
  if (settings.ml_service_url && !isValidUrl(settings.ml_service_url)) {
    errors.ml_service_url = 'URL invalide';
  }
  if (settings.ollama_url && !isValidUrl(settings.ollama_url)) {
    errors.ollama_url = 'URL invalide';
  }
  if (settings.frontend_url && !isValidUrl(settings.frontend_url)) {
    errors.frontend_url = 'URL invalide';
  }
  
  // SNMP network base validation
  if (settings.snmp_network_base && !isValidIpBase(settings.snmp_network_base)) {
    errors.snmp_network_base = 'Réseau base SNMP invalide (ex: 192.168.1)';
  }
  
  return errors;
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function isValidIpBase(ipBase) {
  const parts = ipBase.split('.');
  if (parts.length !== 3) return false;
  return parts.every(part => !isNaN(part) && parseInt(part) >= 0 && parseInt(part) <= 255);
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

    // Simulation / Mock Mode
    // @mode simulation - Quand activé, retourne des données simulées au lieu d'appeler les services réels
    simulation_mode: process.env.SIMULATION_MODE === 'true',

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