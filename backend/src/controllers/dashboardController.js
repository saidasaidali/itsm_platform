// backend/src/controllers/dashboardController.js
import pool from '../db.js';
import { t } from '../utils/i18n.js';

// GET /api/dashboard/realtime — vue temps réel complète
export async function getRealtimeDashboard(req, res) {
  try {
    // 1. Machines online/offline
    const { rows: machineStats } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE l.is_online = TRUE)  AS online,
        COUNT(*) FILTER (WHERE l.is_online = FALSE OR l.is_online IS NULL) AS offline,
        COUNT(*) AS total
      FROM assets a
      LEFT JOIN asset_live_state l ON l.asset_id = a.id
      WHERE a.type = 'Ordinateur' AND a.status != 'Retiré'
    `);

    // 2. Alertes en cours (anomalies ouvertes)
    const { rows: alertStats } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
        COUNT(*) FILTER (WHERE severity = 'high')     AS high,
        COUNT(*) FILTER (WHERE severity = 'medium')   AS medium,
        COUNT(*) AS total
      FROM asset_anomalies WHERE status = 'open'
    `);

    // 3. Nouveaux équipements détectés (dernières 24h)
    const { rows: newAssets } = await pool.query(`
      SELECT id, asset_tag, type, brand, model, discovery_method, created_at
      FROM assets
      WHERE created_at > NOW() - INTERVAL '24 hours'
        AND discovery_method IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // 4. Utilisation par département
    const { rows: byDepartment } = await pool.query(`
      SELECT
        COALESCE(department, 'Non spécifié') AS department,
        COUNT(*) AS asset_count,
        COUNT(*) FILTER (WHERE status = 'En service') AS in_service,
        COUNT(*) FILTER (WHERE status = 'En panne')   AS broken
      FROM assets
      WHERE status != 'Retiré'
      GROUP BY department
      ORDER BY asset_count DESC
    `);

    // 5. Tickets auto-générés récents
    const { rows: autoTickets } = await pool.query(`
      SELECT id, title, auto_trigger_type, status, created_at
      FROM tickets
      WHERE is_auto_generated = TRUE
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // 6. Équipements jamais affectés / non vus (santé du parc)
    const { rows: healthStats } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE last_seen_at IS NULL) AS never_seen,
        COUNT(*) FILTER (WHERE last_seen_at < NOW() - INTERVAL '3 days' AND last_seen_at IS NOT NULL) AS missing
      FROM assets
      WHERE type IN ('Ordinateur','Imprimante','Switch','Serveur') AND status != 'Retiré'
    `);

    // 7. ML Risk Score aggregation
    const { rows: mlRiskStats } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE risk_level = 'critique') AS critical_count,
        COUNT(*) FILTER (WHERE risk_level = 'élevé')    AS high_count,
        COUNT(*) FILTER (WHERE risk_level = 'modéré')   AS medium_count,
        COUNT(*) FILTER (WHERE risk_level = 'faible')   AS low_count,
        ROUND(AVG(risk_score)::numeric, 1)              AS avg_risk_score,
        COUNT(*)                                         AS total_scored
      FROM asset_risk_scores
      WHERE computed_at > NOW() - INTERVAL '24 hours'
    `);

    // 8. Top 5 assets les plus risqués
    const { rows: topRiskyAssets } = await pool.query(`
      SELECT a.id, a.asset_tag, a.type, a.brand, a.model,
             rs.risk_score, rs.risk_level, rs.computed_at
      FROM asset_risk_scores rs
      JOIN assets a ON a.id = rs.asset_id
      WHERE rs.computed_at > NOW() - INTERVAL '24 hours'
      ORDER BY rs.risk_score DESC
      LIMIT 5
    `);

    // 9. ML prédictions de pannes actives
    const { rows: mlFailurePredictions } = await pool.query(`
      SELECT a.id, a.asset_tag, a.type,
             rs.risk_score, rs.risk_level
      FROM asset_risk_scores rs
      JOIN assets a ON a.id = rs.asset_id
      WHERE rs.risk_level IN ('critique', 'élevé')
        AND rs.computed_at > NOW() - INTERVAL '24 hours'
      ORDER BY rs.risk_score DESC
      LIMIT 10
    `);

    return res.json({
      success: true,
      data: {
        machines: machineStats[0],
        alerts: alertStats[0],
        newAssets,
        byDepartment,
        autoTickets,
        health: healthStats[0],
        ml: {
          riskStats: mlRiskStats[0] || { critical_count: 0, high_count: 0, medium_count: 0, low_count: 0, avg_risk_score: 0, total_scored: 0 },
          topRiskyAssets: topRiskyAssets || [],
          failurePredictions: mlFailurePredictions || [],
        },
      },
    });
  } catch (err) {
    console.error('[getRealtimeDashboard]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}

// GET /api/dashboard/network-map — graphe réseau (nœuds + liens)
export async function getNetworkMap(req, res) {
  try {
    const { rows: assets } = await pool.query(`
      SELECT a.id, a.asset_tag, a.type, a.brand, a.model, a.adresse_ip,
             a.department, u.username AS assigned_to_name,
             l.is_online
      FROM assets a
      LEFT JOIN users u ON a.assigned_to = u.id
      LEFT JOIN asset_live_state l ON l.asset_id = a.id
      WHERE a.status != 'Retiré'
        AND a.type IN ('Ordinateur', 'Imprimante', 'Switch', 'Serveur')
    `);

    const { rows: relations } = await pool.query(`
      SELECT source_asset_id, target_asset_id, relation_type
      FROM asset_relations
    `);

    return res.json({
      success: true,
      data: { nodes: assets, edges: relations },
    });
  } catch (err) {
    console.error('[getNetworkMap]', err.message);
    return res.status(500).json({ success: false, message: t(req, 'server_error') });
  }
}