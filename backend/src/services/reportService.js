// backend/src/services/reportService.js
import pool from '../db.js';
import ollama from 'ollama';
import dotenv from 'dotenv';
import fs from 'fs/promises';
dotenv.config();

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// ── Gather Ticket Analytics ──────────────────────────────────────────────────
export async function getTicketAnalytics(periodStart, periodEnd) {
  try {
    // Basic stats
    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status IN ('Nouveau', 'Assigné', 'En cours', 'En attente')) AS open,
        COUNT(*) FILTER (WHERE status IN ('Résolu', 'Clôturé')) AS closed,
        COUNT(*) FILTER (WHERE status = 'Nouveau') AS new_tickets,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_time,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) FILTER (WHERE updated_at IS NOT NULL) AS avg_response_time
      FROM tickets
      WHERE created_at >= $1 AND created_at <= $2
    `, [periodStart, periodEnd]);

    // SLA compliance (tickets resolved within SLA timeframe)
    const { rows: slaStats } = await pool.query(`
      SELECT
        COUNT(*) AS total_with_sla,
        COUNT(*) FILTER (WHERE resolved_at <= due_date) AS compliant
      FROM tickets
      WHERE created_at >= $1 AND created_at <= $2
        AND due_date IS NOT NULL
        AND status IN ('Résolu', 'Clôturé')
    `, [periodStart, periodEnd]);

    const slaCompliance = slaStats[0].total_with_sla > 0
      ? Math.round((slaStats[0].compliant / slaStats[0].total_with_sla) * 100)
      : 0;

    // Tickets by priority
    const { rows: byPriority } = await pool.query(`
      SELECT priority, COUNT(*) as count
      FROM tickets
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY priority
      ORDER BY count DESC
    `, [periodStart, periodEnd]);

    // Tickets by category
    const { rows: byCategory } = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM tickets
      WHERE created_at >= $1 AND created_at <= $2
        AND category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `, [periodStart, periodEnd]);

    // Tickets by department (via assigned user or asset)
    const { rows: byDepartment } = await pool.query(`
      SELECT COALESCE(a.department, 'Non assigné') as department, COUNT(*) as count
      FROM tickets t
      LEFT JOIN assets a ON t.asset_id = a.id
      WHERE t.created_at >= $1 AND t.created_at <= $2
      GROUP BY a.department
      ORDER BY count DESC
    `, [periodStart, periodEnd]);

    // Daily ticket creation
    const { rows: dailyTickets } = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM tickets
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [periodStart, periodEnd]);

    // Previous period comparison
    const periodLength = (new Date(periodEnd) - new Date(periodStart)) / (1000 * 60 * 60 * 24);
    const prevPeriodStart = new Date(new Date(periodStart).getTime() - (periodLength * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const prevPeriodEnd = new Date(new Date(periodStart).getTime() - (24 * 60 * 60 * 1000)).toISOString().split('T')[0];

    const { rows: prevStats } = await pool.query(`
      SELECT COUNT(*) as total
      FROM tickets
      WHERE created_at >= $1 AND created_at <= $2
    `, [prevPeriodStart, prevPeriodEnd]);

    const currentTotal = stats[0].total;
    const previousTotal = prevStats[0].total;
    const evolution = previousTotal > 0
      ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
      : 0;

    return {
      total: currentTotal,
      open: stats[0].open,
      closed: stats[0].closed,
      avgResolutionTime: Math.round(stats[0].avg_resolution_time || 0),
      avgResponseTime: Math.round(stats[0].avg_response_time || 0),
      slaCompliance,
      byPriority: byPriority.map(p => ({ priority: p.priority, count: parseInt(p.count) })),
      byCategory: byCategory.map(c => ({ category: c.category, count: parseInt(c.count) })),
      byDepartment: byDepartment.map(d => ({ department: d.department, count: parseInt(d.count) })),
      dailyTickets: dailyTickets.map(d => ({ date: d.date, count: parseInt(d.count) })),
      evolution
    };
  } catch (err) {
    console.error('[getTicketAnalytics]', err.message);
    return null;
  }
}

// ── Gather Asset Analytics ───────────────────────────────────────────────────
export async function getAssetAnalytics(periodStart, periodEnd) {
  try {
    // Basic stats
    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'En service') AS in_service,
        COUNT(*) FILTER (WHERE status = 'En panne') AS broken,
        COUNT(*) FILTER (WHERE status = 'Hors service') AS out_of_service
      FROM assets
      WHERE status != 'Retiré'
    `);

    // Availability rate
    const availability = stats[0].total > 0
      ? Math.round((stats[0].in_service / stats[0].total) * 100)
      : 0;

    // Assets by type
    const { rows: byType } = await pool.query(`
      SELECT type, COUNT(*) as count
      FROM assets
      WHERE status != 'Retiré'
      GROUP BY type
      ORDER BY count DESC
    `);

    // Assets by department
    const { rows: byDepartment } = await pool.query(`
      SELECT department, COUNT(*) as count
      FROM assets
      WHERE status != 'Retiré' AND department IS NOT NULL
      GROUP BY department
      ORDER BY count DESC
    `);

    // Assets with most incidents
    const { rows: topIncidents } = await pool.query(`
      SELECT a.id, a.asset_tag, a.type, a.brand, a.model, COUNT(t.id) as incident_count
      FROM assets a
      JOIN tickets t ON t.asset_id = a.id
      WHERE t.created_at >= $1 AND t.created_at <= $2
      GROUP BY a.id, a.asset_tag, a.type, a.brand, a.model
      ORDER BY incident_count DESC
      LIMIT 10
    `, [periodStart, periodEnd]);

    // High-risk assets from ML
    const { rows: highRiskAssets } = await pool.query(`
      SELECT a.id, a.asset_tag, a.type, a.brand, a.model,
             rs.risk_score, rs.risk_level, rs.computed_at
      FROM asset_risk_scores rs
      JOIN assets a ON a.id = rs.asset_id
      WHERE rs.risk_level IN ('critique', 'élevé')
        AND rs.computed_at >= $1
      ORDER BY rs.risk_score DESC
      LIMIT 10
    `, [periodStart]);

    // Assets predicted to fail soon (from ML predictions)
    const { rows: failurePredictions } = await pool.query(`
      SELECT a.id, a.asset_tag, a.type, a.brand, a.model,
             rs.risk_score, rs.risk_level
      FROM asset_risk_scores rs
      JOIN assets a ON a.id = rs.asset_id
      WHERE rs.risk_level = 'critique'
        AND rs.computed_at >= $1
      ORDER BY rs.risk_score DESC
      LIMIT 5
    `, [periodStart]);

    return {
      total: stats[0].total,
      inService: stats[0].in_service,
      broken: stats[0].broken,
      availability,
      byType: byType.map(t => ({ type: t.type, count: parseInt(t.count) })),
      byDepartment: byDepartment.map(d => ({ department: d.department, count: parseInt(d.count) })),
      topIncidents: topIncidents.map(a => ({
        asset_tag: a.asset_tag,
        type: a.type,
        brand: a.brand,
        model: a.model,
        incident_count: parseInt(a.incident_count)
      })),
      highRisk: highRiskAssets.map(a => ({
        asset_tag: a.asset_tag,
        type: a.type,
        brand: a.brand,
        model: a.model,
        risk_score: parseFloat(a.risk_score),
        risk_level: a.risk_level
      })),
      failurePredictions: failurePredictions.map(a => ({
        asset_tag: a.asset_tag,
        type: a.type,
        risk_score: parseFloat(a.risk_score),
        risk_level: a.risk_level
      }))
    };
  } catch (err) {
    console.error('[getAssetAnalytics]', err.message);
    return null;
  }
}

// ── Gather Technician Performance ────────────────────────────────────────────
export async function getTechnicianPerformance(periodStart, periodEnd) {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.username,
        COUNT(t.id) FILTER (WHERE t.assigned_to = u.id) as assigned_tickets,
        COUNT(t.id) FILTER (WHERE t.assigned_to = u.id AND t.status IN ('Résolu', 'Clôturé')) as resolved_tickets,
        AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) FILTER (WHERE t.assigned_to = u.id AND t.resolved_at IS NOT NULL) as avg_resolution_time,
        COUNT(t.id) FILTER (WHERE t.assigned_to = u.id AND t.status NOT IN ('Résolu', 'Clôturé')) as active_tickets
      FROM users u
      LEFT JOIN tickets t ON t.assigned_to = u.id
        AND t.created_at >= $1 AND t.created_at <= $2
      WHERE u.role_id = (SELECT id FROM roles WHERE name = 'Technicien')
        AND u.status = 'active'
      GROUP BY u.id, u.username
      ORDER BY resolved_tickets DESC NULLS LAST
    `, [periodStart, periodEnd]);

    // Calculate workload percentage
    const maxActive = Math.max(...rows.map(r => parseInt(r.active_tickets)), 1);

    return rows.map(r => ({
      id: r.id,
      username: r.username,
      assigned: parseInt(r.assigned_tickets),
      resolved: parseInt(r.resolved_tickets),
      avgResolutionTime: Math.round(r.avg_resolution_time || 0),
      workload: Math.round((r.active_tickets / maxActive) * 100)
    }));
  } catch (err) {
    console.error('[getTechnicianPerformance]', err.message);
    return [];
  }
}

// ── Gather AI Analytics ──────────────────────────────────────────────────────
export async function getAIAnalytics(periodStart, periodEnd) {
  try {
    // Sentiment distribution
    const { rows: sentimentStats } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE sentiment = 'positif') as positive,
        COUNT(*) FILTER (WHERE sentiment = 'neutre') as neutral,
        COUNT(*) FILTER (WHERE sentiment = 'négatif') as negative,
        COUNT(*) FILTER (WHERE sentiment_is_critical = true) as critical,
        COUNT(*) as total
      FROM tickets
      WHERE created_at >= $1 AND created_at <= $2
        AND sentiment IS NOT NULL
    `, [periodStart, periodEnd]);

    // Critical sentiment rate
    const criticalRate = sentimentStats[0].total > 0
      ? Math.round((sentimentStats[0].critical / sentimentStats[0].total) * 100)
      : 0;

    // Predictive maintenance stats
    const { rows: predictiveStats } = await pool.query(`
      SELECT COUNT(*) as count
      FROM asset_risk_scores
      WHERE computed_at >= $1
        AND risk_level IN ('critique', 'élevé')
    `, [periodStart]);

    // Security incidents (anomalies with security type)
    const { rows: securityIncidents } = await pool.query(`
      SELECT COUNT(*) as count
      FROM asset_anomalies
      WHERE detected_at >= $1 AND detected_at <= $2
        AND anomaly_type LIKE '%sécurité%' OR anomaly_type LIKE '%security%'
    `, [periodStart, periodEnd]);

    // Chatbot usage
    const { rows: chatbotUsage } = await pool.query(`
      SELECT COUNT(*) as count
      FROM chatbot_logs
      WHERE created_at >= $1 AND created_at <= $2
    `, [periodStart, periodEnd]);

    // Knowledge base usage
    const { rows: kbUsage } = await pool.query(`
      SELECT SUM(views_count) as total_views
      FROM knowledge_articles
      WHERE updated_at >= $1 AND updated_at <= $2
    `, [periodStart, periodEnd]);

    return {
      sentiment: {
        positive: parseInt(sentimentStats[0].positive),
        neutral: parseInt(sentimentStats[0].neutral),
        negative: parseInt(sentimentStats[0].negative),
        critical: parseInt(sentimentStats[0].critical),
        criticalRate
      },
      stats: {
        predictiveMaintenance: parseInt(predictiveStats[0].count),
        highRiskAssets: parseInt(predictiveStats[0].count),
        securityIncidents: parseInt(securityIncidents[0].count),
        chatbotUsage: parseInt(chatbotUsage[0].count),
        kbUsage: parseInt(kbUsage[0].total_views || 0)
      }
    };
  } catch (err) {
    console.error('[getAIAnalytics]', err.message);
    return null;
  }
}

// ── Generate Executive Summary using Ollama ──────────────────────────────────
export async function generateExecutiveSummary(analytics) {
  try {
    const prompt = `Tu es un analyste ITSM expert. Génère un résumé exécutif professionnel en français basé sur les données suivantes :

## Analytique des Tickets
- Total: ${analytics.tickets.total}
- Ouverts: ${analytics.tickets.open}
- Fermés: ${analytics.tickets.closed}
- Temps moyen de résolution: ${analytics.tickets.avgResolutionTime}h
- Taux conformité SLA: ${analytics.tickets.slaCompliance}%
- Évolution vs période précédente: ${analytics.tickets.evolution > 0 ? '+' : ''}${analytics.tickets.evolution}%

## Analytique des Équipements
- Total: ${analytics.assets.total}
- En service: ${analytics.assets.inService}
- En panne: ${analytics.assets.broken}
- Taux de disponibilité: ${analytics.assets.availability}%
- Équipements à haut risque: ${analytics.assets.highRisk.length}

## Performance des Techniciens
- Nombre de techniciens actifs: ${analytics.technicians.length}
- Tickets résolus: ${analytics.technicians.reduce((sum, t) => sum + t.resolved, 0)}

## Analytique IA
- Sentiment critique: ${analytics.ai.sentiment.criticalRate}%
- Prédictions maintenance: ${analytics.ai.stats.predictiveMaintenance}
- Incidents sécurité: ${analytics.ai.stats.securityIncidents}
- Utilisation chatbot: ${analytics.ai.stats.chatbotUsage}

Génère un résumé exécutif structuré avec :
1. Principales réalisations
2. Principaux problèmes
3. Tendances observées
4. Recommandations
5. Risques identifiés
6. Actions suggérées pour le mois prochain

Sois concis, professionnel et factuel. Maximum 300 mots.`;

    // Use fetch directly instead of ollama library to avoid syntax issues
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 512
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (err) {
    console.error('[generateExecutiveSummary]', err.message);
    return 'Résumé exécutif non disponible. Veuillez consulter les sections détaillées du rapport.';
  }
}

// ── Main Report Generation Function ──────────────────────────────────────────
export async function generateReport(reportType, periodStart, periodEnd, generatedBy) {
  try {
    // Gather all analytics in parallel
    const [ticketAnalytics, assetAnalytics, technicianPerformance, aiAnalytics] = await Promise.all([
      getTicketAnalytics(periodStart, periodEnd),
      getAssetAnalytics(periodStart, periodEnd),
      getTechnicianPerformance(periodStart, periodEnd),
      getAIAnalytics(periodStart, periodEnd)
    ]);

    if (!ticketAnalytics || !assetAnalytics || !aiAnalytics) {
      throw new Error('Failed to gather analytics data');
    }

    // Generate executive summary (optional - won't fail if Ollama is not available)
    let executiveSummary = null;
    try {
      executiveSummary = await generateExecutiveSummary({
        tickets: ticketAnalytics,
        assets: assetAnalytics,
        technicians: technicianPerformance,
        ai: aiAnalytics
      });
    } catch (err) {
      console.warn('[generateReport] Executive summary generation failed, continuing without it:', err.message);
      executiveSummary = null;
    }

    // Prepare report data
    const reportData = {
      type: reportType,
      period_start: periodStart,
      period_end: periodEnd,
      tickets: ticketAnalytics,
      assets: assetAnalytics,
      technicians: technicianPerformance,
      ai: aiAnalytics,
      executiveSummary
    };

    // Generate PDF
    const { generateReportPDF } = await import('../utils/pdfGenerator.js');
    const filepath = await generateReportPDF(reportData);

    // Save report metadata to database
    const { rows } = await pool.query(
      `INSERT INTO reports (report_type, period_start, period_end, generated_by, file_path, status)
       VALUES ($1, $2, $3, $4, $5, 'completed')
       RETURNING *`,
      [reportType, periodStart, periodEnd, generatedBy, filepath]
    );

    return rows[0];
  } catch (err) {
    console.error('[generateReport]', err.message);

    // Save failed report
    try {
      await pool.query(
        `INSERT INTO reports (report_type, period_start, period_end, generated_by, status, error_message)
         VALUES ($1, $2, $3, $4, 'failed', $5)`,
        [reportType, periodStart, periodEnd, generatedBy, err.message]
      );
    } catch (dbErr) {
      console.error('[generateReport] Failed to save error report:', dbErr.message);
    }

    throw err;
  }
}

// ── Get Report History ───────────────────────────────────────────────────────
export async function getReportHistory(page = 1, limit = 20) {
  try {
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(`
      SELECT r.*, u.username as generated_by_name
      FROM reports r
      LEFT JOIN users u ON r.generated_by = u.id
      ORDER BY r.generated_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const { rows: countRow } = await pool.query('SELECT COUNT(*) as total FROM reports');

    return {
      reports: rows,
      total: parseInt(countRow[0].total),
      page,
      limit,
      totalPages: Math.ceil(countRow[0].total / limit)
    };
  } catch (err) {
    console.error('[getReportHistory]', err.message);
    return { reports: [], total: 0, page, limit, totalPages: 0 };
  }
}

// ── Delete Report ────────────────────────────────────────────────────────────
export async function deleteReport(reportId) {
  try {
    // Get report info
    const { rows } = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (!rows[0]) return false;

    const report = rows[0];

    // Delete file if exists
    if (report.file_path) {
      try {
        await fs.unlink(report.file_path);
      } catch (err) {
        console.warn(`[deleteReport] Could not delete file: ${report.file_path}`);
      }
    }

    // Delete database record
    await pool.query('DELETE FROM reports WHERE id = $1', [reportId]);

    return true;
  } catch (err) {
    console.error('[deleteReport]', err.message);
    return false;
  }
}

