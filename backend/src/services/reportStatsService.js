// backend/src/services/reportStatsService.js
// Service de calcul des statistiques avancées pour les rapports IT

import pool from '../db.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeQuery(query, params = []) {
  return pool.query(query, params).catch(err => {
    console.error('[SQL Error]', err.message);
    return { rows: [] };
  });
}

function safeNum(val, def = 0) {
  return parseInt(val) || def;
}

function safeDiv(a, b, def = 0) {
  if (!b || b === 0) return def;
  return a / b;
}

function buildWhereClause(filters, paramIndex = 0) {
  const conditions = [];
  const params = [];
  let idx = paramIndex;

  if (filters.department) {
    conditions.push(`a.department = $${++idx}`);
    params.push(filters.department);
  }
  if (filters.service) {
    conditions.push(`a.service = $${++idx}`);
    params.push(filters.service);
  }
  if (filters.asset_type) {
    conditions.push(`a.type = $${++idx}`);
    params.push(filters.asset_type);
  }
  if (filters.status) {
    conditions.push(`a.status = $${++idx}`);
    params.push(filters.status);
  }

  return { where: conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '', params };
}

// ── Statistiques: Parc Informatique ────────────────────────────────────────────

export async function getAssetParkStats(periodStart, periodEnd, filters = {}) {
  console.log('[Stats] Parc informatique...');
  const startTime = Date.now();

  try {
    const { where, params } = buildWhereClause(filters, 0);
    // Les requêtes sur assets n'utilisent que periodStart (pour les garanties)
    // et les filtres, pas periodEnd
    const assetParams = [periodStart, ...params];

    // Statistiques de base
    const basicStats = await safeQuery(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE a.status = 'En service') AS en_service,
        COUNT(*) FILTER (WHERE a.status = 'En panne') AS en_panne,
        COUNT(*) FILTER (WHERE a.status = 'Hors service') AS hors_service,
        COUNT(*) FILTER (WHERE a.status = 'En stock') AS en_stock,
        COUNT(*) FILTER (WHERE a.status = 'En maintenance') AS en_maintenance,
        COUNT(*) FILTER (WHERE a.status = 'Retiré') AS retire,
        COUNT(*) FILTER (WHERE a.assigned_to IS NOT NULL) AS affectes,
        COUNT(*) FILTER (WHERE a.assigned_to IS NULL) AS non_affectes,
        COUNT(*) FILTER (WHERE a.warranty_end >= $1) AS sous_garantie,
        COUNT(*) FILTER (WHERE a.warranty_end < $1 AND a.warranty_end IS NOT NULL) AS garantie_expiree,
        COUNT(*) FILTER (WHERE a.discovery_method = 'auto_discovery') AS decouverts_auto
      FROM assets a
      WHERE 1=1 ${where}
    `, assetParams);

    if (!basicStats.rows[0]) {
      return null;
    }

    const s = basicStats.rows[0];
    
    // Calculer la disponibilité (avec protection division par zéro)
    const totalNonRetire = safeNum(s.en_service) + safeNum(s.en_panne) + safeNum(s.hors_service) + 
                           safeNum(s.en_stock) + safeNum(s.en_maintenance);
    const availability = totalNonRetire > 0 ? 
      Math.round((safeNum(s.en_service) / totalNonRetire) * 100) : 0;

    // Répartition par type (pas de paramètres SQL dans cette requête)
    const byType = await safeQuery(`
      SELECT type, COUNT(*) as count
      FROM assets a
      WHERE 1=1 ${where}
        AND type IS NOT NULL
      GROUP BY type
      ORDER BY count DESC
    `, []);

    // Répartition par marque
    const byBrand = await safeQuery(`
      SELECT brand, COUNT(*) as count
      FROM assets a
      WHERE 1=1 ${where}
        AND brand IS NOT NULL
      GROUP BY brand
      ORDER BY count DESC
      LIMIT 15
    `, []);

    // Répartition par modèle
    const byModel = await safeQuery(`
      SELECT model, COUNT(*) as count
      FROM assets a
      WHERE 1=1 ${where}
        AND model IS NOT NULL
      GROUP BY model
      ORDER BY count DESC
      LIMIT 15
    `, []);

    // Répartition par statut
    const byStatus = await safeQuery(`
      SELECT status, COUNT(*) as count
      FROM assets a
      WHERE 1=1 ${where}
      GROUP BY status
      ORDER BY count DESC
    `, []);

    // Répartition par département
    const byDepartment = await safeQuery(`
      SELECT department, COUNT(*) as count
      FROM assets a
      WHERE 1=1 ${where}
        AND department IS NOT NULL
      GROUP BY department
      ORDER BY count DESC
    `, []);

    // Répartition par service
    const byService = await safeQuery(`
      SELECT service, COUNT(*) as count
      FROM assets a
      WHERE 1=1 ${where}
        AND service IS NOT NULL
      GROUP BY service
      ORDER BY count DESC
      LIMIT 20
    `, []);

    // Répartition par localisation
    const byLocation = await safeQuery(`
      SELECT location, COUNT(*) as count
      FROM assets a
      WHERE 1=1 ${where}
        AND location IS NOT NULL
      GROUP BY location
      ORDER BY count DESC
      LIMIT 15
    `, []);

    // Équipements critiques (score de risque)
    const criticalAssets = await safeQuery(`
      SELECT a.asset_tag, a.type, a.brand, a.model, rs.risk_score, rs.risk_level
      FROM asset_risk_scores rs
      JOIN assets a ON a.id = rs.asset_id
      WHERE rs.risk_level IN ('critique', 'élevé')
        AND rs.computed_at >= $1
      ORDER BY rs.risk_score DESC
      LIMIT 20
    `, [periodStart]);

    const duration = Date.now() - startTime;
    console.log(`[Stats] Parc informatique: ${safeNum(s.total)} équipements in ${duration}ms`);

    return {
      total: safeNum(s.total),
      enService: safeNum(s.en_service),
      enPanne: safeNum(s.en_panne),
      horsService: safeNum(s.hors_service),
      enStock: safeNum(s.en_stock),
      enMaintenance: safeNum(s.en_maintenance),
      retire: safeNum(s.retire),
      affectes: safeNum(s.affectes),
      nonAffectes: safeNum(s.non_affectes),
      sousGarantie: safeNum(s.sous_garantie),
      garantieExpiree: safeNum(s.garantie_expiree),
      decouvertsAuto: safeNum(s.decouverts_auto),
      availability: availability,
      byType: byType.rows.map(t => ({ type: t.type, count: safeNum(t.count) })),
      byBrand: byBrand.rows.map(b => ({ brand: b.brand, count: safeNum(b.count) })),
      byModel: byModel.rows.map(m => ({ model: m.model, count: safeNum(m.count) })),
      byStatus: byStatus.rows.map(st => ({ status: st.status, count: safeNum(st.count) })),
      byDepartment: byDepartment.rows.map(d => ({ department: d.department, count: safeNum(d.count) })),
      byService: byService.rows.map(sv => ({ service: sv.service, count: safeNum(sv.count) })),
      byLocation: byLocation.rows.map(l => ({ location: l.location, count: safeNum(l.count) })),
      criticalAssets: criticalAssets.rows.map(a => ({
        asset_tag: a.asset_tag,
        type: a.type,
        brand: a.brand,
        model: a.model,
        risk_score: parseFloat(a.risk_score) || 0,
        risk_level: a.risk_level
      }))
    };

  } catch (err) {
    console.error('[Stats] Parc informatique error:', err.message);
    return null;
  }
}

// ── Statistiques: Utilisateurs ─────────────────────────────────────────────────

export async function getUserStats(periodStart, periodEnd, filters = {}) {
  console.log('[Stats] Utilisateurs...');
  const startTime = Date.now();

  try {
    // Statistiques de base
    const basicStats = await safeQuery(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'active') AS actifs,
        COUNT(*) FILTER (WHERE status = 'inactive') AS inactifs,
        COUNT(*) FILTER (WHERE status = 'pending') AS en_attente
      FROM users
      WHERE 1=1
    `);

    if (!basicStats.rows[0]) {
      return null;
    }

    const s = basicStats.rows[0];

    // Répartition par rôle
    const byRole = await safeQuery(`
      SELECT r.name, COUNT(u.id) as count
      FROM roles r
      LEFT JOIN users u ON u.role_id = r.id
      GROUP BY r.id, r.name
      ORDER BY count DESC
    `);

    // Répartition par direction
    const byDirection = await safeQuery(`
      SELECT direction, COUNT(*) as count
      FROM users
      WHERE direction IS NOT NULL
      GROUP BY direction
      ORDER BY count DESC
      LIMIT 15
    `);

    // Répartition par division
    const byDivision = await safeQuery(`
      SELECT division, COUNT(*) as count
      FROM users
      WHERE division IS NOT NULL
      GROUP BY division
      ORDER BY count DESC
      LIMIT 15
    `);

    // Répartition par service
    const byService = await safeQuery(`
      SELECT service, COUNT(*) as count
      FROM users
      WHERE service IS NOT NULL
      GROUP BY service
      ORDER BY count DESC
      LIMIT 20
    `);

    // Utilisateurs sans équipement
    const withoutAssets = await safeQuery(`
      SELECT COUNT(*) as count
      FROM users u
      WHERE u.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM asset_assignments aa
          WHERE aa.user_id = u.id
            AND aa.unassigned_at IS NULL
        )
    `);

    // Nombre moyen d'équipements par utilisateur
    const avgAssetsPerUser = await safeQuery(`
      SELECT AVG(asset_count) as avg_count
      FROM (
        SELECT u.id, COUNT(aa.id) as asset_count
        FROM users u
        LEFT JOIN asset_assignments aa ON aa.user_id = u.id AND aa.unassigned_at IS NULL
        WHERE u.status = 'active'
        GROUP BY u.id
      ) sub
    `);

    // Dernières connexions (top 10)
    const lastLogins = await safeQuery(`
      SELECT u.username, u.email, u.direction, u.service,
             MAX(a.created_at) as last_login
      FROM users u
      LEFT JOIN audit_logs a ON a.user_id = u.id AND a.action LIKE '%login%'
      WHERE u.status = 'active'
      GROUP BY u.id, u.username, u.email, u.direction, u.service
      ORDER BY last_login DESC NULLS LAST
      LIMIT 10
    `);

    const duration = Date.now() - startTime;
    console.log(`[Stats] Utilisateurs: ${safeNum(s.total)} utilisateurs in ${duration}ms`);

    return {
      total: safeNum(s.total),
      actifs: safeNum(s.actifs),
      inactifs: safeNum(s.inactifs),
      enAttente: safeNum(s.en_attente),
      byRole: byRole.rows.map(r => ({ role: r.name, count: safeNum(r.count) })),
      byDirection: byDirection.rows.map(d => ({ direction: d.direction, count: safeNum(d.count) })),
      byDivision: byDivision.rows.map(d => ({ division: d.division, count: safeNum(d.count) })),
      byService: byService.rows.map(sv => ({ service: sv.service, count: safeNum(sv.count) })),
      withoutAssets: safeNum(withoutAssets.rows[0]?.count),
      avgAssetsPerUser: parseFloat(avgAssetsPerUser.rows[0]?.avg_count) || 0,
      lastLogins: lastLogins.rows.map(l => ({
        username: l.username,
        email: l.email,
        direction: l.direction,
        service: l.service,
        last_login: l.last_login
      }))
    };

  } catch (err) {
    console.error('[Stats] Utilisateurs error:', err.message);
    return null;
  }
}

// ── Statistiques: Tickets ──────────────────────────────────────────────────────

export async function getTicketStats(periodStart, periodEnd, filters = {}) {
  console.log('[Stats] Tickets...');
  const startTime = Date.now();

  try {
    // Construire les filtres
    const whereConditions = ['t.created_at >= $1', 't.created_at <= $2'];
    const queryParams = [periodStart, periodEnd];

    if (filters.priority) {
      whereConditions.push(`t.priority = $${queryParams.length + 1}`);
      queryParams.push(filters.priority);
    }
    if (filters.category) {
      whereConditions.push(`t.category = $${queryParams.length + 1}`);
      queryParams.push(filters.category);
    }
    if (filters.status) {
      whereConditions.push(`t.status = $${queryParams.length + 1}`);
      queryParams.push(filters.status);
    }
    if (filters.assigned_to) {
      whereConditions.push(`t.assigned_to = $${queryParams.length + 1}`);
      queryParams.push(filters.assigned_to);
    }
    if (filters.created_by) {
      whereConditions.push(`t.created_by = $${queryParams.length + 1}`);
      queryParams.push(filters.created_by);
    }

    const whereClause = whereConditions.join(' AND ');

    // Statistiques de base
    const basicStats = await safeQuery(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE t.status = 'Nouveau') AS nouveau,
        COUNT(*) FILTER (WHERE t.status = 'Assigné') AS assigne,
        COUNT(*) FILTER (WHERE t.status = 'En cours') AS en_cours,
        COUNT(*) FILTER (WHERE t.status = 'En attente') AS en_attente,
        COUNT(*) FILTER (WHERE t.status = 'Résolu') AS resolu,
        COUNT(*) FILTER (WHERE t.status = 'Clôturé') AS cloture,
        COUNT(*) FILTER (WHERE t.status = 'Réouvert') AS rouvert,
        COUNT(*) FILTER (WHERE t.status = 'Annulé') AS annule,
        AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600) FILTER (WHERE t.resolved_at IS NOT NULL) AS avg_resolution,
        AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at))/3600) FILTER (WHERE t.updated_at IS NOT NULL) AS avg_response
      FROM tickets t
      WHERE ${whereClause}
    `, queryParams);

    if (!basicStats.rows[0]) {
      return null;
    }

    const s = basicStats.rows[0];

    // Répartition par priorité
    const byPriority = await safeQuery(`
      SELECT priority, COUNT(*) as count
      FROM tickets t
      WHERE ${whereClause}
      GROUP BY priority
      ORDER BY count DESC
    `, queryParams);

    // Répartition par catégorie
    const byCategory = await safeQuery(`
      SELECT category, COUNT(*) as count
      FROM tickets t
      WHERE ${whereClause}
        AND category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
      LIMIT 15
    `, queryParams);

    // Répartition par service (depuis users)
    const byService = await safeQuery(`
      SELECT u.service, COUNT(t.id) as count
      FROM tickets t
      JOIN users u ON t.created_by = u.id
      WHERE ${whereClause}
        AND u.service IS NOT NULL
      GROUP BY u.service
      ORDER BY count DESC
      LIMIT 15
    `, queryParams);

    // Répartition par technicien
    const byTechnician = await safeQuery(`
      SELECT u.username, COUNT(t.id) as count
      FROM tickets t
      JOIN users u ON t.assigned_to = u.id
      WHERE ${whereClause}
      GROUP BY u.id, u.username
      ORDER BY count DESC
      LIMIT 15
    `, queryParams);

    // SLA compliance
    const slaStats = await safeQuery(`
      SELECT
        COUNT(*) AS total_sla,
        COUNT(*) FILTER (WHERE resolved_at <= due_date) AS compliant
      FROM tickets t
      WHERE ${whereClause}
        AND due_date IS NOT NULL
        AND status IN ('Résolu', 'Clôturé')
    `, queryParams);

    const slaData = slaStats.rows[0] || { total_sla: 0, compliant: 0 };
    const slaCompliance = safeDiv(safeNum(slaData.compliant), safeNum(slaData.total_sla), 0) * 100;

    // Évolution temporelle (par jour)
    const evolution = await safeQuery(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM tickets t
      WHERE ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, queryParams);

    // Taux de résolution (avec protection division par zéro)
    const totalClosed = safeNum(s.resolu) + safeNum(s.cloture);
    const resolutionRate = safeDiv(totalClosed, safeNum(s.total), 0) * 100;
    
    // Vérification de cohérence
    const totalByStatus = safeNum(s.nouveau) + safeNum(s.assigne) + safeNum(s.en_cours) + 
                         safeNum(s.en_attente) + safeNum(s.resolu) + safeNum(s.cloture) + 
                         safeNum(s.rouvert) + safeNum(s.annule);

    // Backlog actuel
    const backlog = safeNum(s.nouveau) + safeNum(s.assigne) + safeNum(s.en_cours) + safeNum(s.en_attente);

    const duration = Date.now() - startTime;
    console.log(`[Stats] Tickets: ${safeNum(s.total)} tickets in ${duration}ms`);

    return {
      total: safeNum(s.total),
      nouveau: safeNum(s.nouveau),
      assigne: safeNum(s.assigne),
      enCours: safeNum(s.en_cours),
      enAttente: safeNum(s.en_attente),
      resolu: safeNum(s.resolu),
      cloture: safeNum(s.cloture),
      rouvert: safeNum(s.rouvert),
      annule: safeNum(s.annule),
      avgResolutionTime: Math.round(safeNum(s.avg_resolution)),
      avgResponseTime: Math.round(safeNum(s.avg_response)),
      slaCompliance: Math.round(slaCompliance),
      byPriority: byPriority.rows.map(p => ({ priority: p.priority, count: safeNum(p.count) })),
      byCategory: byCategory.rows.map(c => ({ category: c.category, count: safeNum(c.count) })),
      byService: byService.rows.map(sv => ({ service: sv.service, count: safeNum(sv.count) })),
      byTechnician: byTechnician.rows.map(t => ({ technician: t.username, count: safeNum(t.count) })),
      evolution: evolution.rows.map(e => ({ date: e.date, count: safeNum(e.count) })),
      resolutionRate: Math.round(resolutionRate),
      backlog: backlog
    };

  } catch (err) {
    console.error('[Stats] Tickets error:', err.message);
    return null;
  }
}

// ── Statistiques: Sécurité ─────────────────────────────────────────────────────

export async function getSecurityStats(periodStart, periodEnd, filters = {}) {
  console.log('[Stats] Sécurité...');
  const startTime = Date.now();

  try {
    // Incidents de sécurité
    const incidents = await safeQuery(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
        COUNT(*) FILTER (WHERE severity = 'high') AS high,
        COUNT(*) FILTER (WHERE status = 'open') AS open,
        COUNT(*) FILTER (WHERE status = 'investigating') AS investigating,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
        COUNT(*) FILTER (WHERE status = 'closed') AS closed
      FROM security_incidents
      WHERE detected_at >= $1 AND detected_at <= $2
    `, [periodStart, periodEnd]);

    // Répartition par type
    const byType = await safeQuery(`
      SELECT incident_type, COUNT(*) as count
      FROM security_incidents
      WHERE detected_at >= $1 AND detected_at <= $2
      GROUP BY incident_type
      ORDER BY count DESC
    `, [periodStart, periodEnd]);

    // Équipements à risque élevé
    const highRiskAssets = await safeQuery(`
      SELECT a.asset_tag, a.type, a.brand, a.model, rs.risk_score, rs.risk_level, rs.computed_at
      FROM asset_risk_scores rs
      JOIN assets a ON a.id = rs.asset_id
      WHERE rs.risk_level IN ('élevé', 'critique')
        AND rs.computed_at >= $1
      ORDER BY rs.risk_score DESC
      LIMIT 20
    `, [periodStart]);

    // Évolution des scores de risque
    const riskEvolution = await safeQuery(`
      SELECT 
        DATE(computed_at) as date,
        AVG(risk_score) as avg_score,
        COUNT(*) FILTER (WHERE risk_level = 'critique') as critical_count,
        COUNT(*) FILTER (WHERE risk_level = 'élevé') as high_count
      FROM asset_risk_scores
      WHERE computed_at >= $1 AND computed_at <= $2
      GROUP BY DATE(computed_at)
      ORDER BY date ASC
    `, [periodStart, periodEnd]);

    // Derniers incidents
    const recentIncidents = await safeQuery(`
      SELECT si.id, si.incident_type, si.severity, si.status,
             t.title as ticket_title, si.detected_at
      FROM security_incidents si
      JOIN tickets t ON t.id = si.ticket_id
      WHERE si.detected_at >= $1 AND si.detected_at <= $2
      ORDER BY si.detected_at DESC
      LIMIT 10
    `, [periodStart, periodEnd]);

    const duration = Date.now() - startTime;
    console.log(`[Stats] Sécurité: ${safeNum(incidents.rows[0]?.total)} incidents in ${duration}ms`);

    return {
      total: safeNum(incidents.rows[0]?.total),
      critical: safeNum(incidents.rows[0]?.critical),
      high: safeNum(incidents.rows[0]?.high),
      open: safeNum(incidents.rows[0]?.open),
      investigating: safeNum(incidents.rows[0]?.investigating),
      resolved: safeNum(incidents.rows[0]?.resolved),
      closed: safeNum(incidents.rows[0]?.closed),
      byType: byType.rows.map(t => ({ type: t.incident_type, count: safeNum(t.count) })),
      highRiskAssets: highRiskAssets.rows.map(a => ({
        asset_tag: a.asset_tag,
        type: a.type,
        brand: a.brand,
        model: a.model,
        risk_score: parseFloat(a.risk_score) || 0,
        risk_level: a.risk_level,
        computed_at: a.computed_at
      })),
      riskEvolution: riskEvolution.rows.map(r => ({
        date: r.date,
        avg_score: parseFloat(r.avg_score) || 0,
        critical_count: safeNum(r.critical_count),
        high_count: safeNum(r.high_count)
      })),
      recentIncidents: recentIncidents.rows.map(i => ({
        id: i.id,
        incident_type: i.incident_type,
        severity: i.severity,
        status: i.status,
        ticket_title: i.ticket_title,
        detected_at: i.detected_at
      }))
    };

  } catch (err) {
    console.error('[Stats] Sécurité error:', err.message);
    return null;
  }
}

// ── Statistiques: Découverte Réseau ────────────────────────────────────────────

export async function getNetworkDiscoveryStats(periodStart, periodEnd, filters = {}) {
  console.log('[Stats] Découverte réseau...');
  const startTime = Date.now();

  try {
    // Équipements détectés
    const detected = await safeQuery(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'unresolved') AS unresolved,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
        COUNT(*) FILTER (WHERE status = 'ignored') AS ignored
      FROM unknown_devices
      WHERE first_seen >= $1 AND first_seen <= $2
    `, [periodStart, periodEnd]);

    // Nouveaux équipements
    const newDevices = await safeQuery(`
      SELECT COUNT(*) as count
      FROM unknown_devices
      WHERE first_seen >= $1 AND first_seen <= $2
    `, [periodStart, periodEnd]);

    // Équipements hors ligne
    const offlineDevices = await safeQuery(`
      SELECT COUNT(*) as count
      FROM unknown_devices
      WHERE last_seen < NOW() - INTERVAL '7 days'
        AND last_seen >= $1
    `, [periodStart]);

    // Historique des découvertes
    const discoveryHistory = await safeQuery(`
      SELECT 
        DATE(first_seen) as date,
        COUNT(*) as count
      FROM unknown_devices
      WHERE first_seen >= $1 AND first_seen <= $2
      GROUP BY DATE(first_seen)
      ORDER BY date ASC
    `, [periodStart, periodEnd]);

    const duration = Date.now() - startTime;
    console.log(`[Stats] Découverte réseau: ${safeNum(detected.rows[0]?.total)} appareils in ${duration}ms`);

    return {
      total: safeNum(detected.rows[0]?.total),
      unresolved: safeNum(detected.rows[0]?.unresolved),
      resolved: safeNum(detected.rows[0]?.resolved),
      ignored: safeNum(detected.rows[0]?.ignored),
      newDevices: safeNum(newDevices.rows[0]?.count),
      offlineDevices: safeNum(offlineDevices.rows[0]?.count),
      discoveryHistory: discoveryHistory.rows.map(h => ({
        date: h.date,
        count: safeNum(h.count)
      }))
    };

  } catch (err) {
    console.error('[Stats] Découverte réseau error:', err.message);
    return null;
  }
}

// ── Statistiques: Assistant IA ─────────────────────────────────────────────────

export async function getAIAssistantStats(periodStart, periodEnd, filters = {}) {
  console.log('[Stats] Assistant IA...');
  const startTime = Date.now();

  try {
    // Conversations
    const conversations = await safeQuery(`
      SELECT
        COUNT(DISTINCT session_key) as total_sessions,
        COUNT(*) as total_messages,
        COUNT(DISTINCT user_id) as unique_users
      FROM smart_assistant_logs
      WHERE created_at >= $1 AND created_at <= $2
    `, [periodStart, periodEnd]);

    // Tickets créés automatiquement
    const autoTickets = await safeQuery(`
      SELECT COUNT(*) as count
      FROM smart_assistant_logs
      WHERE created_at >= $1 AND created_at <= $2
        AND ticket_created_id IS NOT NULL
    `, [periodStart, periodEnd]);

    // Intentions détectées
    const intents = await safeQuery(`
      SELECT intent, COUNT(*) as count
      FROM smart_assistant_logs
      WHERE created_at >= $1 AND created_at <= $2
        AND intent IS NOT NULL
      GROUP BY intent
      ORDER BY count DESC
    `, [periodStart, periodEnd]);

    // Temps moyen de traitement
    const avgProcessing = await safeQuery(`
      SELECT AVG(processing_time_ms) as avg_ms
      FROM smart_assistant_logs
      WHERE created_at >= $1 AND created_at <= $2
        AND processing_time_ms IS NOT NULL
    `, [periodStart, periodEnd]);

    // Taux de résolution automatique
    const autoResolution = await safeQuery(`
      SELECT 
        COUNT(*) as total_with_case,
        COUNT(*) FILTER (WHERE ticket_created_id IS NOT NULL) as resolved
      FROM smart_assistant_logs
      WHERE created_at >= $1 AND created_at <= $2
    `, [periodStart, periodEnd]);

    const resolutionRate = safeDiv(
      safeNum(autoResolution.rows[0]?.resolved),
      safeNum(autoResolution.rows[0]?.total_with_case),
      0
    ) * 100;

    // Utilisation quotidienne
    const dailyUsage = await safeQuery(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as messages,
        COUNT(DISTINCT session_key) as sessions
      FROM smart_assistant_logs
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [periodStart, periodEnd]);

    const duration = Date.now() - startTime;
    console.log(`[Stats] Assistant IA: ${safeNum(conversations.rows[0]?.total_messages)} messages in ${duration}ms`);

    return {
      totalSessions: safeNum(conversations.rows[0]?.total_sessions),
      totalMessages: safeNum(conversations.rows[0]?.total_messages),
      uniqueUsers: safeNum(conversations.rows[0]?.unique_users),
      autoTicketsCreated: safeNum(autoTickets.rows[0]?.count),
      intents: intents.rows.map(i => ({ intent: i.intent, count: safeNum(i.count) })),
      avgProcessingTime: Math.round(safeNum(avgProcessing.rows[0]?.avg_ms) / 1000), // en secondes
      autoResolutionRate: Math.round(resolutionRate),
      dailyUsage: dailyUsage.rows.map(d => ({
        date: d.date,
        messages: safeNum(d.messages),
        sessions: safeNum(d.sessions)
      }))
    };

  } catch (err) {
    console.error('[Stats] Assistant IA error:', err.message);
    return null;
  }
}

// ── Statistiques: Activité Plateforme ──────────────────────────────────────────

export async function getPlatformActivityStats(periodStart, periodEnd, filters = {}) {
  console.log('[Stats] Activité plateforme...');
  const startTime = Date.now();

  try {
    // Nombre de connexions
    const logins = await safeQuery(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
        AND action LIKE '%login%'
    `, [periodStart, periodEnd]);

    // Activité par utilisateur (top 10)
    const activityByUser = await safeQuery(`
      SELECT u.username, u.email, u.direction,
             COUNT(a.id) as action_count,
             MAX(a.created_at) as last_action
      FROM audit_logs a
      JOIN users u ON a.user_id = u.id
      WHERE a.created_at >= $1 AND a.created_at <= $2
      GROUP BY u.id, u.username, u.email, u.direction
      ORDER BY action_count DESC
      LIMIT 10
    `, [periodStart, periodEnd]);

    // Actions d'administration
    const adminActions = await safeQuery(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
        AND (action LIKE '%admin%' OR action LIKE '%setting%' OR action LIKE '%config%')
      GROUP BY action
      ORDER BY count DESC
      LIMIT 15
    `, [periodStart, periodEnd]);

    // Évolution quotidienne
    const dailyEvolution = await safeQuery(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as actions
      FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [periodStart, periodEnd]);

    // Dernières opérations importantes
    const recentOperations = await safeQuery(`
      SELECT a.action, a.entity, a.entity_id, u.username, a.created_at
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.created_at >= $1 AND a.created_at <= $2
      ORDER BY a.created_at DESC
      LIMIT 20
    `, [periodStart, periodEnd]);

    const duration = Date.now() - startTime;
    console.log(`[Stats] Activité plateforme: ${safeNum(logins.rows[0]?.count)} connexions in ${duration}ms`);

    return {
      totalLogins: safeNum(logins.rows[0]?.count),
      activityByUser: activityByUser.rows.map(u => ({
        username: u.username,
        email: u.email,
        direction: u.direction,
        action_count: safeNum(u.action_count),
        last_action: u.last_action
      })),
      adminActions: adminActions.rows.map(a => ({
        action: a.action,
        count: safeNum(a.count)
      })),
      dailyEvolution: dailyEvolution.rows.map(d => ({
        date: d.date,
        actions: safeNum(d.actions)
      })),
      recentOperations: recentOperations.rows.map(o => ({
        action: o.action,
        entity: o.entity,
        entity_id: o.entity_id,
        username: o.username,
        created_at: o.created_at
      }))
    };

  } catch (err) {
    console.error('[Stats] Activité plateforme error:', err.message);
    return null;
  }
}

// ── Fonction principale: Récupérer toutes les statistiques ─────────────────────

export async function getAllReportStats(periodStart, periodEnd, filters = {}) {
  console.log('\n[Stats] ========== DÉBUT GÉNÉRATION STATISTIQUES ==========');
  console.log('[Stats] Période:', periodStart, 'à', periodEnd);
  console.log('[Stats] Filtres:', filters);
  const globalStart = Date.now();

  try {
    const results = await Promise.allSettled([
      getAssetParkStats(periodStart, periodEnd, filters),
      getUserStats(periodStart, periodEnd, filters),
      getTicketStats(periodStart, periodEnd, filters),
      getSecurityStats(periodStart, periodEnd, filters),
      getNetworkDiscoveryStats(periodStart, periodEnd, filters),
      getAIAssistantStats(periodStart, periodEnd, filters),
      getPlatformActivityStats(periodStart, periodEnd, filters)
    ]);

    console.log('[Stats] Résultats des appels:');
    results.forEach((result, index) => {
      const moduleNames = ['Parc Informatique', 'Utilisateurs', 'Tickets', 'Sécurité', 'Réseau', 'IA', 'Activité'];
      if (result.status === 'fulfilled') {
        const data = result.value;
        console.log(`  ${moduleNames[index]}:`, data ? 'OK' : 'NULL');
        if (data) {
          console.log(`    - Clés disponibles:`, Object.keys(data));
        }
      } else {
        console.log(`  ${moduleNames[index]}: ERREUR -`, result.reason?.message);
      }
    });

    const [
      assets,
      users,
      tickets,
      security,
      network,
      ai,
      platform
    ] = results.map(r => r.status === 'fulfilled' ? r.value : null);

    const globalDuration = Date.now() - globalStart;
    console.log(`[Stats] ========== TERMINÉ en ${globalDuration}ms ==========\n`);

    const finalStats = {
      assets,
      users,
      tickets,
      security,
      network,
      ai,
      platform,
      generatedAt: new Date().toISOString(),
      period: { start: periodStart, end: periodEnd },
      filters
    };

    console.log('[Stats] Structure finale retournée:', {
      hasAssets: !!finalStats.assets,
      hasUsers: !!finalStats.users,
      hasTickets: !!finalStats.tickets,
      hasSecurity: !!finalStats.security,
      hasNetwork: !!finalStats.network,
      hasAI: !!finalStats.ai,
      hasPlatform: !!finalStats.platform
    });

    return finalStats;

  } catch (err) {
    console.error('[Stats] Erreur globale:', err.message);
    console.error('[Stats] Stack:', err.stack);
    return null;
  }
}

// ── Récupération des filtres disponibles ──────────────────────────────────────

export async function getAvailableFilters() {
  console.log('[Stats] Récupération des filtres disponibles...');

  try {
    const [departments, services, assetTypes, assetStatuses, priorities, categories] = await Promise.all([
      safeQuery('SELECT DISTINCT department FROM users WHERE department IS NOT NULL ORDER BY department'),
      safeQuery('SELECT DISTINCT service FROM users WHERE service IS NOT NULL ORDER BY service'),
      safeQuery('SELECT DISTINCT type FROM assets WHERE type IS NOT NULL ORDER BY type'),
      safeQuery('SELECT DISTINCT status FROM assets WHERE status IS NOT NULL ORDER BY status'),
      safeQuery('SELECT DISTINCT priority FROM tickets WHERE priority IS NOT NULL ORDER BY priority'),
      safeQuery('SELECT DISTINCT category FROM tickets WHERE category IS NOT NULL ORDER BY category')
    ]);

    return {
      departments: departments.rows.map(r => r.department),
      services: services.rows.map(r => r.service),
      assetTypes: assetTypes.rows.map(r => r.type),
      assetStatuses: assetStatuses.rows.map(r => r.status),
      priorities: priorities.rows.map(r => r.priority),
      categories: categories.rows.map(r => r.category)
    };

  } catch (err) {
    console.error('[Stats] Erreur filtres:', err.message);
    return null;
  }
}