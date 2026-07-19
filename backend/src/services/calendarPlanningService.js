// backend/src/services/calendarPlanningService.js
// Service de planning des techniciens - Calculs charge, disponibilité, conflits
import pool from '../db.js';

const WORKING_HOURS_PER_DAY = 7; // 7h par jour (9h-12h, 13h-17h)
const WORKING_DAYS_PER_WEEK = 5; // Lundi-Vendredi

/**
 * Calcule les statistiques de planning pour un technicien
 */
export async function getTechnicianStats(userId, period = 'week') {
  const now = new Date();
  let startDate, endDate;
  
  if (period === 'day') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
  } else if (period === 'week') {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
  } else if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const stats = {
    userId,
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    plannedHours: 0,
    availableHours: 0,
    occupiedHours: 0,
    freeHours: 0,
    occupancyRate: 0,
    events: [],
    conflicts: [],
    dailyBreakdown: []
  };

  // Heures totales disponibles sur la période
  const totalWorkingMinutes = await calculateWorkingMinutes(startDate, endDate);
  stats.availableHours = Math.round(totalWorkingMinutes / 60 * 10) / 10;

  // Récupérer les événements du technicien
  const { rows: events } = await pool.query(`
    SELECT 
      ce.*,
      EXTRACT(EPOCH FROM (ce.end_date - ce.start_date)) / 3600 as duration_hours
    FROM calendar_events ce
    WHERE ce.assigned_to = $1
      AND ce.start_date >= $2
      AND ce.start_date < $3
      AND ce.status NOT IN ('cancelled')
    ORDER BY ce.start_date ASC
  `, [userId, startDate.toISOString(), endDate.toISOString()]);

  // Récupérer les tickets assignés ayant une due_date dans la période
  const { rows: tickets } = await pool.query(`
    SELECT 
      t.id, t.title, t.due_date, t.priority, t.status,
      a.asset_tag,
      EXTRACT(EPOCH FROM (t.due_date - NOW())) / 3600 as hours_until_due
    FROM tickets t
    LEFT JOIN assets a ON t.asset_id = a.id
    WHERE t.assigned_to = $1
      AND t.due_date >= $2
      AND t.due_date < $3
      AND t.status NOT IN ('Résolu', 'Clôturé')
    ORDER BY t.due_date ASC
  `, [userId, startDate.toISOString(), endDate.toISOString()]);

  // Calculer les heures planifiées
  let totalPlannedMinutes = 0;
  const dailyMap = new Map();

  for (const event of events) {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    const durationMs = end - start;
    const durationMinutes = Math.round(durationMs / 60000);
    
    totalPlannedMinutes += durationMinutes;
    stats.events.push({
      id: event.id,
      title: event.title,
      event_type: event.event_type,
      start_date: event.start_date,
      end_date: event.end_date,
      duration_hours: Math.round(durationMinutes / 60 * 10) / 10,
      color: event.color,
      status: event.status
    });

    // Détection de conflits (événements qui se chevauchent)
    const eventDay = start.toISOString().split('T')[0];
    if (!dailyMap.has(eventDay)) {
      dailyMap.set(eventDay, []);
    }
    dailyMap.get(eventDay).push({ start, end, title: event.title });
  }

  // Détection des conflits
  for (const [day, dayEvents] of dailyMap) {
    dayEvents.sort((a, b) => a.start - b.start);
    for (let i = 0; i < dayEvents.length - 1; i++) {
      if (dayEvents[i].end > dayEvents[i + 1].start) {
        stats.conflicts.push({
          date: day,
          event1: dayEvents[i].title,
          event2: dayEvents[i + 1].title,
          overlap_minutes: Math.round((dayEvents[i].end - dayEvents[i + 1].start) / 60000)
        });
      }
    }
  }

  stats.plannedHours = Math.round(totalPlannedMinutes / 60 * 10) / 10;
  stats.occupiedHours = Math.min(stats.plannedHours, stats.availableHours);
  stats.freeHours = Math.round((stats.availableHours - stats.occupiedHours) * 10) / 10;
  stats.occupancyRate = stats.availableHours > 0 
    ? Math.round((stats.occupiedHours / stats.availableHours) * 100) 
    : 0;

  // Répartition journalière
  for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().split('T')[0];
    if (d.getDay() !== 0 && d.getDay() !== 6) { // Pas weekend
      const dayEvents = dailyMap.get(dayStr) || [];
      const dayMinutes = dayEvents.reduce((sum, e) => 
        sum + Math.round((e.end - e.start) / 60000), 0);
      
      stats.dailyBreakdown.push({
        date: dayStr,
        dayName: d.toLocaleDateString('fr-FR', { weekday: 'long' }),
        plannedMinutes: dayMinutes,
        plannedHours: Math.round(dayMinutes / 60 * 10) / 10,
        availableHours: WORKING_HOURS_PER_DAY,
        occupancyPercent: Math.round((dayMinutes / (WORKING_HOURS_PER_DAY * 60)) * 100),
        eventsCount: dayEvents.length
      });
    }
  }

  // Tickets en attente pour la période
  stats.pendingTickets = tickets.map(t => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    priority: t.priority,
    status: t.status,
    asset_tag: t.asset_tag,
    urgency: t.hours_until_due < 24 ? 'high' : t.hours_until_due < 72 ? 'medium' : 'low'
  }));

  return stats;
}

/**
 * Récupère le planning de tous les techniciens
 */
export async function getAllTechniciansPlanning(period = 'week') {
  const { rows: techs } = await pool.query(`
    SELECT u.id, u.username, u.email
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'Technicien' AND u.status = 'active'
    ORDER BY u.username ASC
  `);

  const plannings = [];
  for (const tech of techs) {
    const stats = await getTechnicianStats(tech.id, period);
    plannings.push({
      technician: {
        id: tech.id,
        username: tech.username,
        email: tech.email
      },
      stats
    });
  }

  return plannings;
}

/**
 * Calcule les minutes ouvrables sur une période
 */
async function calculateWorkingMinutes(startDate, endDate) {
  let totalMinutes = 0;
  const current = new Date(startDate);

  while (current < endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Lundi-Vendredi
      totalMinutes += WORKING_HOURS_PER_DAY * 60;
    }
    current.setDate(current.getDate() + 1);
  }

  return totalMinutes;
}

/**
 * Détecte les conflits de planning entre techniciens
 */
export async function detectTeamConflicts(date, technicians) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const techIds = technicians.map(t => t.id || t);
  
  const { rows: events } = await pool.query(`
    SELECT 
      ce.*,
      u.username as technician_name
    FROM calendar_events ce
    JOIN users u ON ce.assigned_to = u.id
    WHERE ce.assigned_to = ANY($1::int[])
      AND ce.start_date >= $2
      AND ce.start_date < $3
      AND ce.status NOT IN ('cancelled')
    ORDER BY ce.assigned_to, ce.start_date ASC
  `, [techIds, startOfDay.toISOString(), endOfDay.toISOString()]);

  // Grouper par technicien
  const techEvents = {};
  for (const event of events) {
    if (!techEvents[event.assigned_to]) {
      techEvents[event.assigned_to] = [];
    }
    techEvents[event.assigned_to].push(event);
  }

  // Détecter les conflits (même créneau horaire pour plusieurs techniciens)
  const conflicts = [];
  const timeSlots = {};

  for (const event of events) {
    const key = `${event.start_date}-${event.end_date}`;
    if (!timeSlots[key]) {
      timeSlots[key] = [];
    }
    timeSlots[key].push(event);
  }

  for (const [slot, slotEvents] of Object.entries(timeSlots)) {
    if (slotEvents.length > 1) {
      conflicts.push({
        start_date: slotEvents[0].start_date,
        end_date: slotEvents[0].end_date,
        technicians: slotEvents.map(e => ({
          id: e.assigned_to,
          name: e.technician_name,
          event_title: e.title,
          event_id: e.id
        })),
        reason: 'Créneau partagé entre plusieurs techniciens'
      });
    }
  }

  return conflicts;
}

export default {
  getTechnicianStats,
  getAllTechniciansPlanning,
  detectTeamConflicts
};