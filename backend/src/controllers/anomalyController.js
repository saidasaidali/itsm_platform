// backend/src/controllers/anomalyController.js
import pool from '../db.js';

// GET /api/anomalies — liste avec filtres
export async function getAnomalies(req, res) {
  const { status, severity, type } = req.query;
  const params = [];
  let where = 'WHERE 1=1';

  if (status)   { params.push(status);   where += ` AND a.status = $${params.length}`; }
  if (severity) { params.push(severity); where += ` AND a.severity = $${params.length}`; }
  if (type)     { params.push(type);     where += ` AND a.anomaly_type = $${params.length}`; }

  try {
    const { rows } = await pool.query(
      `SELECT a.*, ast.asset_tag, ast.brand, ast.model, u.username AS resolved_by_name
       FROM asset_anomalies a
       LEFT JOIN assets ast ON a.asset_id = ast.id
       LEFT JOIN users u    ON a.resolved_by = u.id
       ${where}
       ORDER BY
         CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         a.detected_at DESC`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getAnomalies]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// GET /api/anomalies/unknown-devices
export async function getUnknownDevices(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM unknown_devices WHERE status = 'unresolved' ORDER BY last_seen DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getUnknownDevices]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// PATCH /api/anomalies/:id/resolve
export async function resolveAnomaly(req, res) {
  const { id } = req.params;
  const { status } = req.body; // 'acknowledged' | 'resolved' | 'ignored'
  const userId = req.user.id;

  if (!['acknowledged', 'resolved', 'ignored'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Statut invalide.' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE asset_anomalies SET
         status = $1,
         resolved_at = CASE WHEN $1 IN ('resolved','ignored') THEN NOW() ELSE resolved_at END,
         resolved_by = $2
       WHERE id = $3
       RETURNING *`,
      [status, userId, id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Anomalie introuvable.' });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[resolveAnomaly]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// GET /api/anomalies/stats
export async function getAnomalyStats(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open')                          AS open,
         COUNT(*) FILTER (WHERE status = 'open' AND severity = 'critical') AS critical,
         COUNT(*) FILTER (WHERE status = 'open' AND severity = 'high')     AS high,
         COUNT(*) FILTER (WHERE detected_at > NOW() - INTERVAL '24 hours') AS last24h
       FROM asset_anomalies`
    );
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[getAnomalyStats]', err.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}