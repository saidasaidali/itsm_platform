// backend/src/controllers/calendarDashboardController.js
// Contrôleur pour le tableau de bord du calendrier
import pool from '../db.js'

// Mapping des types d'événements vers leurs libellés
const EVENT_TYPE_LABELS = {
  intervention_technique: 'Intervention technique',
  maintenance_preventive: 'Maintenance préventive',
  maintenance_corrective: 'Maintenance corrective',
  deploiement: 'Déploiement',
  installation_equipement: 'Installation équipement',
  reunion: 'Réunion',
  formation: 'Formation',
  incident_critique: 'Incident critique',
  astreinte: 'Astreinte',
  autre: 'Autre'
}

export const getCalendarDashboard = async (req, res) => {
  try {
    const userId = req.user?.id
    const userRole = req.user?.role

    // 1. Interventions aujourd'hui
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const todayQuery = `
      SELECT ce.*, u.username as assigned_name, a.asset_tag
      FROM calendar_events ce
      LEFT JOIN users u ON ce.assigned_to = u.id
      LEFT JOIN assets a ON ce.asset_id = a.id
      WHERE ce.start_date >= $1 AND ce.start_date < $2
        AND ce.status NOT IN ('cancelled', 'completed')
        AND (ce.assigned_to = $3 OR $4 = 'Admin' OR $4 = 'Technicien')
      ORDER BY ce.start_date ASC
    `
    const { rows: todayEvents } = await pool.query(todayQuery, [
      todayStart.toISOString(),
      todayEnd.toISOString(),
      userId,
      userRole
    ])

    // 2. Interventions cette semaine
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Lundi
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const { rows: weekEvents } = await pool.query(todayQuery, [
      weekStart.toISOString(),
      weekEnd.toISOString(),
      userId,
      userRole
    ])

    // 3. Interventions en retard
    const { rows: overdueEvents } = await pool.query(`
      SELECT ce.*, u.username as assigned_name, a.asset_tag
      FROM calendar_events ce
      LEFT JOIN users u ON ce.assigned_to = u.id
      LEFT JOIN assets a ON ce.asset_id = a.id
      WHERE ce.start_date < NOW()
        AND ce.status NOT IN ('cancelled', 'completed')
        AND (ce.assigned_to = $1 OR $2 = 'Admin' OR $2 = 'Technicien')
      ORDER BY ce.start_date ASC
      LIMIT 20
    `, [userId, userRole])

    // 4. SLA proches (tickets avec due_date dans les 24h)
    const { rows: nearSLA } = await pool.query(`
      SELECT t.*, u.username as assigned_name
      FROM tickets t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.due_date BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
        AND t.status NOT IN ('Résolu', 'Clôturé')
        AND (t.assigned_to = $1 OR $2 = 'Admin' OR $2 = 'Technicien')
      ORDER BY t.due_date ASC
      LIMIT 20
    `, [userId, userRole])

    // 5. Maintenances prévues (7 prochains jours)
    const { rows: upcomingMaintenances } = await pool.query(`
      SELECT ce.*, a.asset_tag, cmc.maintenance_type
      FROM calendar_events ce
      LEFT JOIN assets a ON ce.asset_id = a.id
      LEFT JOIN calendar_maintenance_config cmc ON cmc.asset_id = a.id
      WHERE ce.event_type = 'maintenance_preventive'
        AND ce.start_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        AND ce.status NOT IN ('cancelled', 'completed')
        AND (ce.assigned_to = $1 OR $2 = 'Admin' OR $2 = 'Technicien')
      ORDER BY ce.start_date ASC
      LIMIT 20
    `, [userId, userRole])

    // 6. Garanties expirant bientôt (30 jours)
    const { rows: expiringWarranties } = await pool.query(`
      SELECT a.*, u.username as assigned_name
      FROM assets a
      LEFT JOIN users u ON a.assigned_to = u.id
      WHERE a.warranty_end BETWEEN NOW() AND NOW() + INTERVAL '30 days'
        AND a.status = 'active'
      ORDER BY a.warranty_end ASC
      LIMIT 20
    `, [])

    // 7. Charge des techniciens (7 prochains jours)
    const { rows: technicianLoad } = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.division,
        u.service,
        COUNT(DISTINCT ce.id) FILTER (WHERE ce.start_date >= NOW() AND ce.start_date < NOW() + INTERVAL '7 days') as events_count,
        COALESCE(SUM(EXTRACT(EPOCH FROM (ce.end_date - ce.start_date)) / 3600) 
          FILTER (WHERE ce.start_date >= NOW() AND ce.start_date < NOW() + INTERVAL '7 days'), 0)::numeric(10,1) as planned_hours,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('Nouveau', 'Assigné', 'En cours')) as active_tickets
      FROM users u
      LEFT JOIN calendar_events ce ON ce.assigned_to = u.id
      LEFT JOIN tickets t ON t.assigned_to = u.id
      WHERE u.role_id IN (SELECT id FROM roles WHERE name = 'Technicien') AND u.status = 'active'
      GROUP BY u.id, u.username, u.division, u.service
      ORDER BY planned_hours DESC
    `, [])

    // 8. Disponibilité des équipes (pour les 7 prochains jours)
    const { rows: teamAvailability } = await pool.query(`
      SELECT 
        u.division,
        u.service,
        COUNT(DISTINCT u.id) as total_technicians,
        COUNT(DISTINCT ce.id) FILTER (WHERE ce.start_date >= NOW() AND ce.start_date < NOW() + INTERVAL '7 days') as busy_events
      FROM users u
      LEFT JOIN calendar_events ce ON ce.assigned_to = u.id
      WHERE u.role_id IN (SELECT id FROM roles WHERE name = 'Technicien') AND u.status = 'active'
      GROUP BY u.division, u.service
      ORDER BY total_technicians DESC
    `, [])

    // 9. Répartition par type d'événement (pour graphique)
    const { rows: eventsByType } = await pool.query(`
      SELECT 
        event_type,
        COUNT(*) as count
      FROM calendar_events
      WHERE start_date >= NOW() - INTERVAL '30 days'
      GROUP BY event_type
      ORDER BY count DESC
    `, [])

    // 10. Tendance hebdomadaire (pour graphique)
    const { rows: weeklyTrend } = await pool.query(`
      SELECT 
        DATE_TRUNC('week', start_date) as week_start,
        COUNT(*) as count
      FROM calendar_events
      WHERE start_date >= NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', start_date)
      ORDER BY week_start ASC
    `, [])

    res.json({
      success: true,
      data: {
        today: todayEvents,
        thisWeek: weekEvents,
        overdue: overdueEvents,
        nearSLA,
        upcomingMaintenances,
        expiringWarranties,
        technicianLoad,
        teamAvailability,
        eventsByType: eventsByType.map(e => ({
          type: e.event_type,
          label: EVENT_TYPE_LABELS[e.event_type] || e.event_type,
          count: parseInt(e.count)
        })),
        weeklyTrend: weeklyTrend.map(w => ({
          week: new Date(w.week_start).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
          count: parseInt(w.count)
        }))
      }
    })
  } catch (err) {
    console.error('[CalendarDashboard] Error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
}

export default {
  getCalendarDashboard
}