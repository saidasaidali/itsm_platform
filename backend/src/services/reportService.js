// backend/src/services/reportService.js
// Version améliorée pour la génération de rapports avec statistiques avancées

import pool from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSettings } from './settingsService.js';
import { generateReportPDF } from '../utils/pdfGenerator.js';
import * as reportStatsService from './reportStatsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OLLAMA_URL = getSettings().ollama_url;
const OLLAMA_MODEL = getSettings().ollama_model;
const REPORTS_DIR = path.join(process.cwd(), 'reports');

// ── Helpers simples et robustes ──────────────────────────────────────────────

async function safeQuery(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return { success: true, data: result.rows };
  } catch (err) {
    console.error('[SQL Error]', err.message);
    return { success: false, data: null };
  }
}

function safeDiv(a, b, def = 0) {
  if (!b || b === 0) return def;
  return a / b;
}

function safeNum(val, def = 0) {
  return parseInt(val) || def;
}

// ── Chargement du prompt depuis fichier ──────────────────────────────────────

async function loadPrompt(templateName, data) {
  try {
    const promptPath = path.join(__dirname, '../prompts', `${templateName}.txt`);
    let prompt = await fs.readFile(promptPath, 'utf-8');

    // Remplacement des placeholders {{key}} par les valeurs
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      const value = data[key] !== undefined ? data[key] : 'N/A';
      prompt = prompt.replace(regex, value);
    });

    return prompt;
  } catch (err) {
    console.error('[Prompt Error]', err.message);
    return null;
  }
}

// ── Génération du résumé exécutif ────────────────────────────────────────────

async function generateExecutiveSummary(analytics) {
  const startTime = Date.now();
  console.log('[Ollama] Starting request...');

  try {
    // Préparer les données pour le prompt
    const promptData = {
      'tickets.total': analytics.tickets?.total || 0,
      'tickets.open': analytics.tickets?.open || 0,
      'tickets.closed': analytics.tickets?.closed || 0,
      'tickets.avgResolutionTime': analytics.tickets?.avgResolutionTime || 0,
      'tickets.slaCompliance': analytics.tickets?.slaCompliance || 0,
      'tickets.evolution': analytics.tickets?.evolution || 0,
      'assets.total': analytics.assets?.total || 0,
      'assets.inService': analytics.assets?.inService || 0,
      'assets.broken': analytics.assets?.broken || 0,
      'assets.availability': analytics.assets?.availability || 0,
      'assets.highRiskCount': analytics.assets?.highRisk?.length || 0,
      'technicians.count': analytics.technicians?.length || 0,
      'technicians.resolved': analytics.technicians?.reduce((sum, t) => sum + t.resolved, 0) || 0,
      'ai.criticalRate': analytics.ai?.sentiment?.criticalRate || 0,
      'ai.predictiveMaintenance': analytics.ai?.stats?.predictiveMaintenance || 0,
      'ai.securityIncidents': analytics.ai?.stats?.securityIncidents || 0,
      'ai.chatbotUsage': analytics.ai?.stats?.chatbotUsage || 0
    };

    const prompt = loadPrompt('executive_summary', promptData);
    if (!prompt) {
      throw new Error('Failed to load prompt template');
    }

    // Timeout de 30 secondes
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout 30s')), 30000);
    });

    const fetchPromise = fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 512 }
      })
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;
    console.log(`[Ollama] Success in ${duration}ms`);
    return data.response;

  } catch (err) {
    const duration = Date.now() - startTime;
    console.warn(`[Ollama] Failed after ${duration}ms: ${err.message}`);
    return null;
  }
}

// ── Résumé local de secours ──────────────────────────────────────────────────

function generateLocalSummary(analytics) {
  const parts = [];

  if (analytics.tickets?.total > 0) {
    parts.push(`${analytics.tickets.total} tickets analysés (${analytics.tickets.open} ouverts, ${analytics.tickets.closed} fermés).`);
    if (analytics.tickets.slaCompliance > 0) {
      parts.push(`Conformité SLA: ${analytics.tickets.slaCompliance}%.`);
    }
  }

  if (analytics.assets?.total > 0) {
    parts.push(`${analytics.assets.total} équipements (${analytics.assets.availability}% disponibilité).`);
    if (analytics.assets.highRisk?.length > 0) {
      parts.push(`${analytics.assets.highRisk.length} équipements à haut risque.`);
    }
  }

  if (analytics.technicians?.length > 0) {
    const resolved = analytics.technicians.reduce((sum, t) => sum + t.resolved, 0);
    parts.push(`${analytics.technicians.length} techniciens actifs, ${resolved} tickets résolus.`);
  }

  if (analytics.ai?.stats) {
    if (analytics.ai.stats.predictiveMaintenance > 0) {
      parts.push(`${analytics.ai.stats.predictiveMaintenance} prédictions de maintenance.`);
    }
    if (analytics.ai.stats.securityIncidents > 0) {
      parts.push(`${analytics.ai.stats.securityIncidents} incidents de sécurité.`);
    }
  }

  if (parts.length === 0) {
    return "Aucune donnée disponible pour la période sélectionnée. Le rapport contient uniquement les en-têtes de sections.";
  }

  return parts.join(' ');
}

// ── Fonction principale de génération ────────────────────────────────────────

export async function generateReport(reportType, periodStart, periodEnd, generatedBy, filters = {}) {
  const reportId = `RPT_${Date.now()}`;
  const globalStart = Date.now();

  console.log(`\n[${reportId}] === START REPORT ===`);
  console.log(`[${reportId}] Type: ${reportType}, Period: ${periodStart} to ${periodEnd}`);

  try {
    // 1. Créer le rapport en base avec status 'generating'
    const { rows } = await pool.query(
      `INSERT INTO reports (report_type, period_start, period_end, generated_by, status)
       VALUES ($1, $2, $3, $4, 'generating')
       RETURNING *`,
      [reportType, periodStart, periodEnd, generatedBy]
    );

    const report = rows[0];
    const reportDbId = report.id;
    console.log(`[${reportId}] Created in DB with ID ${reportDbId}`);

    // 2. Collecter toutes les statistiques avancées
    console.log(`[${reportId}] Collecting advanced statistics...`);
    const statsStart = Date.now();
    const fullStats = await reportStatsService.getAllReportStats(periodStart, periodEnd, filters);
    const statsDuration = Date.now() - statsStart;
    console.log(`[${reportId}] Statistics collected in ${statsDuration}ms`);

    // 3. Générer le résumé exécutif (IA ou fallback)
    let executiveSummary = null;
    let summarySource = 'none';

    // Préparer les analytics pour le résumé (format compatible)
    const analytics = {
      tickets: fullStats?.tickets ? {
        total: fullStats.tickets.total,
        open: fullStats.tickets.nouveau + fullStats.tickets.assigne + fullStats.tickets.enCours + fullStats.tickets.enAttente,
        closed: fullStats.tickets.resolu + fullStats.tickets.cloture,
        avgResolutionTime: fullStats.tickets.avgResolutionTime,
        slaCompliance: fullStats.tickets.slaCompliance,
        evolution: fullStats.tickets.evolution
      } : null,
      assets: fullStats?.assets ? {
        total: fullStats.assets.total,
        inService: fullStats.assets.enService,
        broken: fullStats.assets.enPanne,
        availability: fullStats.assets.availability,
        highRisk: fullStats.assets.criticalAssets
      } : null,
      technicians: fullStats?.users ? [] : null,
      ai: fullStats?.ai ? {
        sentiment: fullStats.ai,
        stats: {
          predictiveMaintenance: fullStats.ai.autoTicketsCreated,
          securityIncidents: fullStats.security?.total || 0,
          chatbotUsage: fullStats.ai.totalMessages
        }
      } : null
    };

    const ollamaSummary = await generateExecutiveSummary(analytics);

    if (ollamaSummary) {
      executiveSummary = ollamaSummary;
      summarySource = 'ollama';
      console.log(`[${reportId}] Summary: Ollama`);
    } else {
      executiveSummary = generateLocalSummary(analytics);
      summarySource = 'local';
      console.log(`[${reportId}] Summary: Local fallback`);
    }

    // 4. Générer le PDF avec les statistiques avancées
    console.log(`[${reportId}] Generating PDF...`);
    const pdfStart = Date.now();

    const reportData = {
      type: reportType,
      period_start: periodStart,
      period_end: periodEnd,
      stats: fullStats, // Nouvelles statistiques complètes
      executiveSummary,
      summarySource,
      analyticsStatus: {
        assets: !!fullStats?.assets,
        users: !!fullStats?.users,
        tickets: !!fullStats?.tickets,
        security: !!fullStats?.security,
        network: !!fullStats?.network,
        ai: !!fullStats?.ai,
        platform: !!fullStats?.platform
      }
    };

    const filepath = await generateReportPDF(reportData);
    const pdfDuration = Date.now() - pdfStart;
    console.log(`[${reportId}] PDF generated in ${pdfDuration}ms: ${filepath}`);

    // 5. Mettre à jour le statut
    await pool.query(
      `UPDATE reports SET file_path = $1, status = 'completed' WHERE id = $2`,
      [filepath, reportDbId]
    );

    const totalDuration = Date.now() - globalStart;
    console.log(`[${reportId}] === COMPLETED in ${totalDuration}ms ===\n`);

    return { ...report, file_path: filepath, status: 'completed' };

  } catch (err) {
    const totalDuration = Date.now() - globalStart;
    console.error(`[${reportId}] === FAILED after ${totalDuration}ms:`, err.message);

    // Sauvegarder l'erreur
    try {
      await pool.query(
        `UPDATE reports SET status = 'failed', error_message = $1 WHERE id = $2`,
        [err.message, reportDbId]
      );
    } catch (dbErr) {
      console.error(`[${reportId}] Failed to save error:`, dbErr.message);
    }

    throw err;
  }
}

// ── Récupération de l'historique ─────────────────────────────────────────────

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
      total: safeNum(countRow[0]?.total),
      page,
      limit,
      totalPages: Math.ceil(safeNum(countRow[0]?.total) / limit)
    };
  } catch (err) {
    console.error('[getReportHistory]', err.message);
    return { reports: [], total: 0, page, limit, totalPages: 0 };
  }
}

// ── Suppression d'un rapport ──────────────────────────────────────────────────

export async function deleteReport(reportId) {
  try {
    const { rows } = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (!rows[0]) return false;

    const report = rows[0];

    // Supprimer le fichier PDF
    if (report.file_path) {
      try {
        await fs.unlink(report.file_path);
        console.log(`[deleteReport] File deleted: ${report.file_path}`);
      } catch (err) {
        console.warn(`[deleteReport] Could not delete file: ${err.message}`);
      }
    }

    // Supprimer l'enregistrement
    await pool.query('DELETE FROM reports WHERE id = $1', [reportId]);

    return true;
  } catch (err) {
    console.error('[deleteReport]', err.message);
    return false;
  }
}

// ── Récupération du statut ────────────────────────────────────────────────────

export async function getReportStatus(reportId) {
  try {
    const { rows } = await pool.query(
      'SELECT id, status, error_message, generated_at FROM reports WHERE id = $1',
      [reportId]
    );
    return rows[0] || null;
  } catch (err) {
    console.error('[getReportStatus]', err.message);
    return null;
  }
}