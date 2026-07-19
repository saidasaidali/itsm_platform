// backend/src/services/mlService.js
import pool from '../db.js';
import { getSettings } from './settingsService.js';

const ML_TIMEOUT_MS = 5000;

// ── Construire les features d'un asset depuis PostgreSQL ──────────────────────
export async function buildAssetFeatures(assetId) {
  const { rows } = await pool.query(`
    SELECT
      a.id,
      a.type,
      a.status,
      EXTRACT(YEAR FROM AGE(NOW(), a.purchase_date))   AS age_years,
      COUNT(DISTINCT t.id)                             AS total_tickets,
      COUNT(DISTINCT t.id) FILTER (
          WHERE t.created_at > NOW() - INTERVAL '6 months'
      )                                                AS tickets_6m,
      COUNT(DISTINCT t.id) FILTER (
          WHERE t.priority = 'Haute'
          AND   t.created_at > NOW() - INTERVAL '6 months'
      )                                                AS high_priority_6m,
      AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600)
          FILTER (WHERE t.resolved_at IS NOT NULL)     AS avg_resolution_hours,
      COUNT(DISTINCT an.id)                            AS total_anomalies,
      COUNT(DISTINCT an.id) FILTER (
          WHERE an.detected_at > NOW() - INTERVAL '3 months'
      )                                                AS anomalies_3m,
      COUNT(DISTINCT an.id) FILTER (
          WHERE an.severity = 'high'
      )                                                AS high_severity_anomalies,
      ls.cpu_usage,
      ls.ram_usage,
      ls.disk_free_gb,
      ls.disk_total_gb,
      CASE WHEN ls.disk_total_gb > 0
           THEN (1 - ls.disk_free_gb / ls.disk_total_gb) * 100
           ELSE 50
      END                                              AS disk_usage_pct,
      ls.uptime_hours,
      CASE WHEN ls.is_online THEN 1 ELSE 0 END         AS is_online
    FROM assets a
    LEFT JOIN tickets t          ON t.asset_id = a.id
    LEFT JOIN asset_anomalies an ON an.asset_id = a.id
    LEFT JOIN asset_live_state ls ON ls.asset_id = a.id
    WHERE a.id = $1
    GROUP BY a.id, a.type, a.status, a.purchase_date,
             ls.cpu_usage, ls.ram_usage, ls.disk_free_gb,
             ls.disk_total_gb, ls.uptime_hours, ls.is_online
  `, [assetId]);

  if (!rows[0]) return null;
  const r = rows[0];

  const TYPE_MAP   = { 'Ordinateur': 0, 'Serveur': 1, 'Imprimante': 2 };
  const STATUS_MAP = { 'En service': 0, 'En maintenance': 1, 'Hors service': 2, 'En stock': 3 };

  return {
    asset_id:                Number(assetId),
    age_years:               Number(r.age_years)               || 0,
    total_tickets:           Number(r.total_tickets)           || 0,
    tickets_6m:              Number(r.tickets_6m)              || 0,
    high_priority_6m:        Number(r.high_priority_6m)        || 0,
    avg_resolution_hours:    Number(r.avg_resolution_hours)    || 24,
    total_anomalies:         Number(r.total_anomalies)         || 0,
    anomalies_3m:            Number(r.anomalies_3m)            || 0,
    high_severity_anomalies: Number(r.high_severity_anomalies) || 0,
    cpu_usage:               Number(r.cpu_usage)               || 50,
    ram_usage:               Number(r.ram_usage)               || 50,
    disk_usage_pct:          Number(r.disk_usage_pct)          || 50,
    uptime_hours:            Number(r.uptime_hours)            || 0,
    is_online:               Number(r.is_online)               ?? 1,
    type_enc:                TYPE_MAP[r.type]                  ?? 0,
    status_enc:              STATUS_MAP[r.status]              ?? 0,
  };
}

// ── Appel HTTP vers le service ML ─────────────────────────────────────────────
async function callML(endpoint, body) {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
  try {
    const s = getSettings();
    const ML_URL = s.ml_service_url || 'http://localhost:8001';
    const res = await fetch(`${ML_URL}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
    if (!res.ok) throw new Error(`ML service error ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError')
      console.warn(`[mlService] Timeout sur ${endpoint}`);
    else
      console.error(`[mlService] Erreur ${endpoint}:`, err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Vérifier l'état des modèles ML ────────────────────────────────────────────
export async function checkMLHealth() {
  try {
    const s = getSettings();
    const ML_URL = s.ml_service_url || 'http://localhost:8001';
    const res = await fetch(`${ML_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getMLMetrics() {
  try {
    const s = getSettings();
    const ML_URL = s.ml_service_url || 'http://localhost:8001';
    const res = await fetch(`${ML_URL}/metrics`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── API publique ──────────────────────────────────────────────────────────────
export async function getFullPrediction(assetId) {
  const features = await buildAssetFeatures(assetId);
  if (!features) return null;
  const result = await callML('/predict/full', features);
  
  // Logger la source des prédictions
  if (result) {
    const sources = [];
    if (result.risk) sources.push(`risk:${result.risk.source}`);
    if (result.failure) sources.push(`failure:${result.failure.source}`);
    if (result.anomaly) sources.push(`anomaly:${result.anomaly.source}`);
    console.log(`[mlService] Prédictions pour asset #${assetId} — sources: ${sources.join(', ')}`);
  } else {
    console.warn(`[mlService] Aucune prédiction pour asset #${assetId} (service ML injoignable ou timeout)`);
  }
  
  return result;
}

export async function getRiskScore(assetId) {
  const features = await buildAssetFeatures(assetId);
  if (!features) return null;
  const result = await callML('/predict/risk', features);
  
  // Logger la source
  if (result) {
    console.log(`[mlService] Risk score pour asset #${assetId}: ${result.risk_score} (source: ${result.source || 'inconnue'})`);
  } else {
    console.warn(`[mlService] Risk score non disponible pour asset #${assetId} (fallback côté Python)`);
  }
  
  return result;
}

// ── Sauvegarde du risk score en base pour l'historique et le dashboard ─────────
export async function saveRiskScore(assetId, score, level) {
  try {
    await pool.query(
      `INSERT INTO asset_risk_scores (asset_id, risk_score, risk_level, computed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (asset_id)
       DO UPDATE SET risk_score = $2, risk_level = $3, computed_at = NOW()`,
      [assetId, score, level]
    );
  } catch (err) {
    console.error('[mlService] Erreur sauvegarde risk score:', err.message);
  }
}

// ── Déclencher l'entraînement depuis Node ─────────────────────────────────────
export async function triggerTraining() {
  try {
    const s = getSettings();
    const ML_URL = s.ml_service_url || 'http://localhost:8001';
    const res = await fetch(`${ML_URL}/train`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    console.error('[mlService] Erreur déclenchement entraînement:', err.message);
    return null;
  }
}