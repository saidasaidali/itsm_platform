// backend/src/services/calendarSmartAssistant.js
// Service d'intelligence planning pour le calendrier
// Utilise les modèles IA existants : chatbotBrain, suggestionEngine, scoring ML
import pool from '../db.js';
import { createEvent } from './calendarService.js';
import { notifyAssigned } from './emailService.js';

const WORKING_HOURS_START = 8;   // 8h00
const WORKING_HOURS_END = 18;     // 18h00
const LUNCH_BREAK_START = 12;    // 12h00-14h00 pause
const LUNCH_BREAK_END = 14;
const MAX_SCORE = 100;

/**
 * Détecte les créneaux disponibles sur une période
 * @param {number} technicianId - ID du technicien
 * @param {string} startDate - Date de début
 * @param {string} endDate - Date de fin  
 * @param {number} durationMinutes - Durée souhaitée en minutes
 * @returns {Promise<Array>} Créneaux disponibles
 */
export async function detectAvailableSlots(technicianId, startDate, endDate, durationMinutes = 60) {
  try {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start);
    end.setDate(end.getDate() + 14);

    // Récupérer les événements existants
    const { rows: events } = await pool.query(`
      SELECT start_date, end_date, title, event_type 
      FROM calendar_events 
      WHERE assigned_to = $1
        AND start_date >= $2
        AND start_date < $3
        AND status NOT IN ('cancelled', 'completed')
      ORDER BY start_date ASC
    `, [technicianId, start.toISOString(), end.toISOString()]);

    // Récupérer les tickets avec due_date dans la période
    const { rows: tickets } = await pool.query(`
      SELECT due_date, priority, title
      FROM tickets
      WHERE assigned_to = $1
        AND due_date >= $2
        AND due_date < $3
        AND status NOT IN ('Résolu', 'Clôturé')
      ORDER BY due_date ASC
    `, [technicianId, start.toISOString(), end.toISOString()]);

    // Analyser la charge existante (via chatbotBrain si dispo)
    let workloadScore = 50;
    try {
      const brain = await import('./chatbot/chatbotBrain.js');
      if (brain.default?.analyzeWorkload) {
        workloadScore = await brain.default.analyzeWorkload(technicianId);
      }
    } catch (e) {
      // Fallback : calcul simple
      workloadScore = Math.max(0, 100 - (events.length * 10) - (tickets.length * 5));
    }

    // Générer les créneaux disponibles
    const slots = [];
    const current = new Date(start);

    while (current < end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Pas weekend
        for (let h = WORKING_HOURS_START; h < WORKING_HOURS_END; h++) {
          // Pause déjeuner
          if (h >= LUNCH_BREAK_START && h < LUNCH_BREAK_END) continue;

          const slotStart = new Date(current);
          slotStart.setHours(h, 0, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

          // Ne pas dépasser 18h
          if (slotEnd.getHours() > WORKING_HOURS_END) continue;

          // Vérifier les conflits avec événements
          const hasEventConflict = events.some(event => {
            const eStart = new Date(event.start_date);
            const eEnd = new Date(event.end_date);
            return slotStart < eEnd && slotEnd > eStart;
          });

          // Vérifier les conflits avec tickets du jour
          const hasTicketConflict = tickets.some(t => {
            const tDate = new Date(t.due_date);
            return tDate.toDateString() === current.toDateString();
          });

          if (!hasEventConflict && !hasTicketConflict) {
            slots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              dayOfWeek,
              hour: h,
              hasConflict: false
            });
          }
        }
      }
      current.setDate(current.getDate() + 1);
    }

    return { success: true, data: slots, workloadScore, totalSlots: slots.length };
  } catch (err) {
    console.error('[SmartAssistant] detectAvailableSlots error:', err.message);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Propose la meilleure date pour un événement
 * Utilise le scoring IA existant
 */
export async function suggestBestDate(params) {
  const { event_type, duration_hours = 2, assigned_to, department, preferred_date, asset_id } = params;
  
  try {
    // 1. Récupérer les événements existants
    const { rows: existingEvents } = await pool.query(`
      SELECT ce.*, u.username as assigned_name
      FROM calendar_events ce
      LEFT JOIN users u ON ce.assigned_to = u.id
      WHERE ce.start_date >= NOW()
        AND ce.start_date <= NOW() + INTERVAL '30 days'
        AND ce.status NOT IN ('cancelled', 'completed')
        AND (ce.assigned_to = $1 OR $1 IS NULL)
      ORDER BY ce.start_date ASC
    `, [assigned_to]);

    // 2. Récupérer tickets et maintenances
    const { rows: tickets } = await pool.query(`
      SELECT id, title, due_date, priority FROM tickets
      WHERE assigned_to = $1 AND status IN ('Nouveau', 'Assigné', 'En cours')
        AND due_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
    `, [assigned_to]);

    const { rows: maintenances } = await pool.query(`
      SELECT start_date, end_date, title FROM calendar_events
      WHERE event_type = 'maintenance_preventive'
        AND assigned_to = $1
        AND start_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
    `, [assigned_to]);

    // 3. Utiliser le système de scoring ML si disponible
    let mlScore = null;
    try {
      const { getSettings } = await import('./settingsService.js');
      if (getSettings().enable_ml_service === 'true') {
        // Utiliser les scores ML existants
        const { rows: predictions } = await pool.query(`
          SELECT ml_risk_score, predicted_failure_date 
          FROM ml_predictions 
          WHERE asset_id = $1 
          ORDER BY created_at DESC LIMIT 1
        `, [asset_id]);
        if (predictions[0]) mlScore = predictions[0];
      }
    } catch (e) {
      // ML service non disponible, continuer sans
    }

    // 4. Générer créneaux avec analyse de charge
    const slots = [];
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const timeSlots = [
          { hour: 8, label: 'Matin (08h-10h)' },
          { hour: 10, label: 'Mi-matin (10h-12h)' },
          { hour: 14, label: 'Après-midi (14h-16h)' },
          { hour: 16, label: 'Fin journée (16h-18h)' }
        ];

        for (const ts of timeSlots) {
          const slotStart = new Date(currentDate);
          slotStart.setHours(ts.hour, 0, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setHours(slotStart.getHours() + duration_hours);

          if (slotEnd.getHours() > 18 || (slotEnd.getHours() === 18 && slotEnd.getMinutes() > 0)) continue;

          // Vérifier conflit avec événements
          const hasConflict = existingEvents.some(e => {
            const es = new Date(e.start_date), ee = new Date(e.end_date);
            return slotStart < ee && slotEnd > es;
          });

          const slot = {
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            label: ts.label,
            dayOfWeek,
            date: currentDate.toISOString().split('T')[0],
            hasConflict,
            existingEventsCount: existingEvents.filter(e => {
              const ed = new Date(e.start_date).toISOString().split('T')[0];
              return ed === currentDate.toISOString().split('T')[0];
            }).length,
            pendingTickets: tickets.filter(t => {
              const td = new Date(t.due_date).toISOString().split('T')[0];
              return td === currentDate.toISOString().split('T')[0];
            }).length,
            maintenancesToday: maintenances.filter(m => {
              const md = new Date(m.start_date).toISOString().split('T')[0];
              return md === currentDate.toISOString().split('T')[0];
            }).length,
            score: 0
          };

          // Calcul du score IA
          slot.score = calculateAdvancedScore(slot, event_type, preferred_date, existingEvents, tickets, mlScore);
          slots.push(slot);
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Trier par score
    slots.sort((a, b) => b.score - a.score);

    const bestSlots = slots.filter(s => !s.hasConflict).slice(0, 5);
    const suggested = bestSlots[0];

    if (!suggested) {
      return { success: false, message: 'Aucun créneau disponible dans les 30 prochains jours' };
    }

    return {
      success: true,
      suggested_date: suggested.start,
      suggested_end: suggested.end,
      score: suggested.score,
      label: suggested.label,
      date: suggested.date,
      reason: getAdvancedReason(suggested, mlScore),
      alternatives: bestSlots.slice(1, 4).map(s => ({
        start: s.start,
        end: s.end,
        score: s.score,
        label: s.label,
        date: s.date
      })),
      conflicts_detected: existingEvents.length > 0,
      ml_risk: mlScore ? {
        score: mlScore.ml_risk_score,
        predicted_failure: mlScore.predicted_failure_date
      } : null
    };
  } catch (err) {
    console.error('[SmartAssistant] suggestBestDate error:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Détection avancée des conflits (événements + tickets + maintenances)
 */
export async function detectConflicts(start_date, end_date, assigned_to) {
  try {
    const conflicts = [];
    const warnings = [];

    // 1. Conflits d'événements
    const { rows: eventConflicts } = await pool.query(`
      SELECT ce.id, ce.title, ce.start_date, ce.end_date, ce.event_type,
             u.username as assigned_name
      FROM calendar_events ce
      LEFT JOIN users u ON ce.assigned_to = u.id
      WHERE ce.assigned_to = $1
        AND ce.status NOT IN ('cancelled', 'completed')
        AND (ce.start_date, ce.end_date) OVERLAPS ($2::timestamp, $3::timestamp)
        AND ce.id != COALESCE($4, 0)
      ORDER BY ce.start_date ASC
    `, [assigned_to, start_date, end_date, 0]);

    for (const c of eventConflicts) {
      conflicts.push({
        id: c.id, title: c.title, type: 'calendar_event',
        start: c.start_date, end: c.end_date,
        event_type: c.event_type,
        severity: c.event_type === 'incident_critique' ? 'critical' : 
                 c.event_type === 'intervention_technique' ? 'high' : 'medium'
      });
    }

    // 2. Conflits de tickets (échéances)
    const { rows: ticketConflicts } = await pool.query(`
      SELECT id, title, due_date, priority, category
      FROM tickets
      WHERE assigned_to = $1
        AND status IN ('Nouveau', 'Assigné', 'En cours')
        AND due_date BETWEEN $2 AND $3
      ORDER BY due_date ASC
    `, [assigned_to, start_date, end_date]);

    for (const t of ticketConflicts) {
      conflicts.push({
        id: t.id, title: t.title, type: 'ticket',
        due_date: t.due_date, priority: t.priority,
        category: t.category,
        severity: t.priority === 'Haute' ? 'critical' : 
                 t.priority === 'Moyenne' ? 'high' : 'medium'
      });
    }

    // 3. Conflits de maintenances préventives
    const { rows: maintConflicts } = await pool.query(`
      SELECT ce.id, ce.title, ce.start_date, ce.end_date,
             a.asset_tag, cmc.maintenance_type
      FROM calendar_events ce
      JOIN assets a ON ce.asset_id = a.id
      JOIN calendar_maintenance_config cmc ON cmc.asset_id = a.id
      WHERE ce.event_type = 'maintenance_preventive'
        AND ce.assigned_to = $1
        AND (ce.start_date, ce.end_date) OVERLAPS ($2::timestamp, $3::timestamp)
        AND ce.status NOT IN ('cancelled', 'completed')
    `, [assigned_to, start_date, end_date]);

    for (const m of maintConflicts) {
      warnings.push({
        id: m.id, title: m.title, type: 'maintenance',
        start: m.start_date, end: m.end_date,
        asset_tag: m.asset_tag,
        maintenance_type: m.maintenance_type,
        severity: 'medium'
      });
    }

    // 4. Vérifier la charge de travail du technicien
    const { rows: load } = await pool.query(`
      SELECT COUNT(*) as active_events,
             SUM(EXTRACT(EPOCH FROM (end_date - start_date)) / 3600)::numeric(10,1) as total_hours
      FROM calendar_events
      WHERE assigned_to = $1
        AND start_date >= NOW()
        AND start_date <= NOW() + INTERVAL '7 days'
        AND status NOT IN ('cancelled', 'completed')
    `, [assigned_to]);

    if (parseFloat(load[0]?.total_hours || 0) > 35) {
      warnings.push({
        type: 'workload',
        message: `Charge de travail élevée : ${load[0].total_hours}h planifiées cette semaine (max 35h)`,
        severity: 'warning'
      });
    }

    return {
      success: true,
      conflicts,
      warnings,
      total_conflicts: conflicts.length + warnings.length,
      has_critical: conflicts.some(c => c.severity === 'critical'),
      workload: {
        active_events: parseInt(load[0]?.active_events || 0),
        total_hours: parseFloat(load[0]?.total_hours || 0),
        max_hours: 35
      }
    };
  } catch (err) {
    console.error('[SmartAssistant] detectConflicts error:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Recommande le meilleur technicien avec équilibrage de charge
 * Utilise les scores ML existants et l'analyse de charge
 */
export async function recommendTechnician(event_type, start_date, end_date, department) {
  try {
    // 1. Récupérer tous les techniciens avec leurs indicateurs de charge
    const { rows: technicians } = await pool.query(`
      SELECT 
        u.id, u.username, u.email, u.division, u.service,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('Nouveau', 'Assigné', 'En cours')) as active_tickets,
        COUNT(DISTINCT ce.id) FILTER (WHERE ce.start_date >= NOW() AND ce.status NOT IN ('cancelled', 'completed')) as active_events,
        COALESCE(SUM(EXTRACT(EPOCH FROM (ce.end_date - ce.start_date)) / 3600) 
          FILTER (WHERE ce.start_date >= NOW() AND ce.start_date <= NOW() + INTERVAL '7 days'), 0)::numeric(10,1) as planned_hours,
        COUNT(DISTINCT t.id) FILTER (WHERE t.created_at >= NOW() - INTERVAL '30 days' AND t.status = 'Résolu') as resolved_last_30d
      FROM users u
      LEFT JOIN tickets t ON t.assigned_to = u.id
      LEFT JOIN calendar_events ce ON ce.assigned_to = u.id
      WHERE u.role_id IN (SELECT id FROM roles WHERE name = 'Technicien') AND u.status = 'active'
      GROUP BY u.id, u.username, u.email, u.division, u.service
      ORDER BY active_tickets ASC, planned_hours ASC
    `);

    if (technicians.length === 0) {
      return { success: false, message: 'Aucun technicien disponible' };
    }

    // 2. Calculer le score de chaque technicien
    const scored = [];
    for (const tech of technicians) {
      // Vérifier les conflits pour ce créneau
      const conflictCheck = await detectConflicts(start_date, end_date, tech.id);
      
      // Score composite (0-100)
      const availabilityScore = Math.max(0, 100 - (tech.active_tickets * 8) - (tech.active_events * 12));
      const loadScore = Math.max(0, 100 - (parseFloat(tech.planned_hours) / 35 * 100));
      const performanceScore = Math.min(100, (tech.resolved_last_30d || 0) * 10);
      
      const finalScore = Math.round(
        availabilityScore * 0.4 +  // 40% disponibilité
        loadScore * 0.35 +         // 35% charge actuelle
        performanceScore * 0.25     // 25% performance récente
      );

      // Vérifier si le département correspond
      const departmentMatch = !department || tech.service === department || tech.division === department;

      scored.push({
        id: tech.id,
        username: tech.username,
        email: tech.email,
        division: tech.division,
        service: tech.service,
        active_tickets: tech.active_tickets,
        active_events: tech.active_events,
        planned_hours: tech.planned_hours,
        resolved_last_30d: tech.resolved_last_30d,
        score: finalScore,
        availability_score: Math.round(availabilityScore),
        load_score: Math.round(loadScore),
        performance_score: Math.round(performanceScore),
        is_available: conflictCheck.total_conflicts === 0,
        conflicts: conflictCheck.total_conflicts,
        department_match: departmentMatch
      });
    }

    // 3. Trier : disponible + département match + score
    scored.sort((a, b) => {
      if (a.is_available && !b.is_available) return -1;
      if (!a.is_available && b.is_available) return 1;
      if (a.department_match && !b.department_match) return -1;
      if (!a.department_match && b.department_match) return 1;
      return b.score - a.score;
    });

    const recommended = scored[0];

    return {
      success: true,
      recommended_technician: {
        ...recommended,
        score_details: {
          disponibilité: `${recommended.availability_score}%`,
          charge: `${recommended.load_score}%`,
          performance: `${recommended.performance_score}%`,
          final: `${recommended.score}%`
        }
      },
      alternatives: scored.slice(1, 4).map(t => ({
        id: t.id, username: t.username,
        score: t.score, is_available: t.is_available,
        department_match: t.department_match
      })),
      reasoning: recommended.is_available
        ? `Recommandé : ${recommended.username} (score ${recommended.score}%) - ${recommended.active_tickets} tickets actifs, ${recommended.planned_hours}h planifiées`
        : `Meilleur choix malgré les conflits : ${recommended.username} (score ${recommended.score}%)`
    };
  } catch (err) {
    console.error('[SmartAssistant] recommendTechnician error:', err.message);
    return { success: false, message: err.message };
  }
}

/** 
 * Suggère la meilleure durée pour un événement basée sur l'historique
 */
export async function suggestBestDuration(eventType, assetId, description) {
  try {
    // 1. Analyser durées historiques pour ce type d'événement
    const { rows: historical } = await pool.query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (end_date - start_date)) / 3600)::numeric(10,1) as avg_duration,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (end_date - start_date)) / 3600) as median_duration,
        MIN(EXTRACT(EPOCH FROM (end_date - start_date)) / 3600)::numeric(10,1) as min_duration,
        MAX(EXTRACT(EPOCH FROM (end_date - start_date)) / 3600)::numeric(10,1) as max_duration,
        COUNT(*) as sample_size
      FROM calendar_events
      WHERE event_type = $1
        AND status = 'completed'
        AND created_at >= NOW() - INTERVAL '1 year'
    `, [eventType]);

    const stats = historical[0];

    // 2. Si disponible, utiliser le ML pour affiner
    let mlSuggestion = null;
    if (assetId) {
      try {
        const { rows: ml } = await pool.query(`
          SELECT ml_risk_score, predicted_failure_probability
          FROM ml_predictions
          WHERE asset_id = $1
          ORDER BY created_at DESC LIMIT 1
        `, [assetId]);
        if (ml[0]) mlSuggestion = ml[0];
      } catch (e) { /* ML non disponible */ }
    }

    // 3. Durées recommandées par type
    const defaultDurations = {
      'intervention_technique': { min: 1, recommended: 2, max: 4 },
      'maintenance_preventive': { min: 1, recommended: 2, max: 8 },
      'maintenance_corrective': { min: 2, recommended: 4, max: 8 },
      'deploiement': { min: 2, recommended: 4, max: 8 },
      'installation_equipement': { min: 2, recommended: 3, max: 6 },
      'reunion': { min: 0.5, recommended: 1, max: 3 },
      'formation': { min: 2, recommended: 4, max: 8 },
      'incident_critique': { min: 1, recommended: 2, max: 4 },
      'autre': { min: 0.5, recommended: 1, max: 4 }
    };

    const def = defaultDurations[eventType] || defaultDurations.autre;
    
    // Utiliser les stats historiques si disponibles
    const avgDuration = stats?.avg_duration ? parseFloat(stats.avg_duration) : def.recommended;
    const hasGoodData = stats?.sample_size > 5;

    return {
      success: true,
      suggested_duration: hasGoodData ? avgDuration : def.recommended,
      duration_range: {
        min: hasGoodData ? Math.max(0.5, parseFloat(stats.min_duration)) : def.min,
        max: hasGoodData ? Math.min(8, parseFloat(stats.max_duration)) : def.max
      },
      confidence: hasGoodData ? 'high' : 'medium',
      based_on: hasGoodData 
        ? `${stats.sample_size} événements similaires (moyenne ${avgDuration}h)`
        : `Durée par défaut pour "${eventType}"`,
      ml_risk_factor: mlSuggestion ? {
        risk_score: mlSuggestion.ml_risk_score,
        extended_duration: mlSuggestion.ml_risk_score > 70
      } : null,
      default: def
    };
  } catch (err) {
    console.error('[SmartAssistant] suggestBestDuration error:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Crée automatiquement un événement calendrier lors de la création d'un ticket
 */
export async function createCalendarEventFromTicket(ticket) {
  try {
    const eventTypeMap = {
      'Matériel': 'maintenance_corrective',
      'Logiciel': 'intervention_technique',
      'Réseau': 'intervention_technique',
      'Maintenance': 'maintenance_preventive',
      'Installation': 'installation_equipement'
    };

    const eventType = eventTypeMap[ticket.category] || 'intervention_technique';
    
    const slaHours = { 'Haute': 4, 'Moyenne': 24, 'Basse': 72 };
    const slaHoursCount = slaHours[ticket.priority] || 24;

    const startDate = new Date(ticket.created_at);
    const endDate = new Date(startDate.getTime() + slaHoursCount * 60 * 60 * 1000);

    const eventData = {
      title: `[Ticket #${ticket.id}] ${ticket.title}`,
      description: ticket.description,
      event_type: eventType,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      all_day: false,
      status: 'scheduled',
      color: getEventColorByPriority(ticket.priority),
      ticket_id: ticket.id,
      asset_id: ticket.asset_id,
      assigned_to: ticket.assigned_to,
      created_by: ticket.created_by,
      reminder_1h: true, reminder_1d: true, reminder_start: true
    };

    const event = await createEvent(eventData);

    if (ticket.assigned_to) {
      await notifyAssigned(ticket, ticket.assigned_to, 'Système', ticket.created_by);
    }

    return { success: true, event, message: `Événement créé pour le ticket #${ticket.id}` };
  } catch (err) {
    console.error('[SmartAssistant] createCalendarEventFromTicket error:', err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Suggère la meilleure période pour une maintenance
 */
export async function suggestMaintenancePeriod(asset_id, maintenance_type, duration_hours = 2) {
  try {
    const { rows: assets } = await pool.query(`
      SELECT a.*, COUNT(t.id) as recent_tickets
      FROM assets a
      LEFT JOIN tickets t ON t.asset_id = a.id AND t.created_at >= NOW() - INTERVAL '30 days'
      WHERE a.id = $1 GROUP BY a.id
    `, [asset_id]);

    if (!assets[0]) return { success: false, message: 'Équipement introuvable' };

    const asset = assets[0];

    // Analyser historique des maintenances
    const { rows: history } = await pool.query(`
      SELECT ce.* FROM calendar_events ce
      WHERE ce.asset_id = $1 AND ce.event_type IN ('maintenance_preventive', 'maintenance_corrective')
        AND ce.start_date >= NOW() - INTERVAL '6 months'
      ORDER BY ce.start_date DESC
    `, [asset_id]);

    const frequency = determineMaintenanceFrequency(asset, history);
    const suggestedDate = new Date();
    if (frequency === 'monthly') suggestedDate.setDate(suggestedDate.getDate() + 30);
    else if (frequency === 'quarterly') suggestedDate.setDate(suggestedDate.getDate() + 90);
    else suggestedDate.setDate(suggestedDate.getDate() + 180);

    const bestSlot = await suggestBestDate({
      event_type: 'maintenance_preventive',
      duration_hours,
      department: asset.department,
      preferred_date: suggestedDate.toISOString()
    });

    return {
      success: true,
      asset: { id: asset.id, tag: asset.asset_tag, brand: asset.brand, model: asset.model },
      maintenance_type,
      frequency,
      reason: getMaintenanceReason(asset, history, frequency),
      suggested_period: bestSlot.suggested_date,
      suggested_end: bestSlot.suggested_end,
      score: bestSlot.score,
      alternatives: bestSlot.alternatives,
      history_count: history.length
    };
  } catch (err) {
    console.error('[SmartAssistant] suggestMaintenancePeriod error:', err.message);
    return { success: false, message: err.message };
  }
}

// ─── Fonctions utilitaires ─────────────────────────────

function calculateAdvancedScore(slot, event_type, preferred_date, existingEvents, tickets, mlScore) {
  let score = 50;

  // Bonus date préférée (+30)
  if (preferred_date) {
    const pref = new Date(preferred_date).toISOString().split('T')[0];
    if (slot.date === pref) score += 30;
  }

  // Bonus matin (+10)
  if (slot.hour >= 8 && slot.hour <= 12) score += 10;

  // Bonus proximité (+15 si dans 3 jours, +10 si dans 7)
  const daysFromNow = (new Date(slot.start) - new Date()) / (86400000);
  if (daysFromNow <= 3) score += 15;
  else if (daysFromNow <= 7) score += 10;

  // Malus charge existante (-5 par événement autour)
  score -= slot.existingEventsCount * 5;

  // Malus tickets en attente (-3 par ticket)
  score -= slot.pendingTickets * 3;

  // Bonus si pas de maintenance ce jour (+10)
  if (slot.maintenancesToday === 0) score += 10;

  // Bonus ML si risque élevé, planifier plus tôt (+15)
  if (mlScore?.ml_risk_score > 70 && daysFromNow <= 3) score += 15;

  // Malus si le créneau a un conflit (-50)
  if (slot.hasConflict) score -= 50;

  // Ajustement selon le type d'événement
  if (event_type === 'incident_critique' && daysFromNow <= 1) score += 20;
  if (event_type === 'maintenance_preventive' && daysFromNow >= 3 && daysFromNow <= 14) score += 10;

  return Math.max(0, Math.min(MAX_SCORE, score));
}

function getAdvancedReason(slot, mlScore) {
  const reasons = [];
  if (slot.score >= 80) reasons.push('Créneau optimal');
  else if (slot.score >= 60) reasons.push('Bon créneau');
  else reasons.push('Créneau disponible');

  if (slot.hour >= 8 && slot.hour <= 12) reasons.push('Matinée (meilleure productivité)');
  if (!slot.hasConflict) reasons.push('Aucun conflit');
  if (slot.pendingTickets === 0) reasons.push('Pas de ticket en attente ce jour');
  if (slot.maintenancesToday === 0) reasons.push('Aucune maintenance planifiée ce jour');
  if (mlScore?.ml_risk_score > 70) reasons.push('Risque ML élevé - intervention recommandée rapidement');

  return reasons.join(', ');
}

function determineMaintenanceFrequency(asset, history) {
  if (history.length === 0) return 'semestrial';
  const recent = history.filter(m => new Date(m.start_date) >= new Date(Date.now() - 90 * 86400000));
  if (recent.length >= 3) return 'monthly';
  if (recent.length >= 1) return 'quarterly';
  return 'semestrial';
}

function getMaintenanceReason(asset, history, frequency) {
  const reasons = history.length === 0 
    ? ['Première maintenance planifiée']
    : [`Basé sur ${history.length} maintenance(s) précédente(s)`];
  const labels = {
    'monthly': 'Fréquence mensuelle (pannes fréquentes)',
    'quarterly': 'Fréquence trimestrielle',
    'semestrial': 'Fréquence semestrielle'
  };
  reasons.push(labels[frequency] || frequency);
  return reasons.join('. ');
}

function getEventColorByPriority(priority) {
  return { 'Haute': '#dc3545', 'Moyenne': '#ffc107', 'Basse': '#28a745' }[priority] || '#6c757d';
}

export default {
  detectAvailableSlots,
  suggestBestDate,
  detectConflicts,
  recommendTechnician,
  suggestBestDuration,
  createCalendarEventFromTicket,
  suggestMaintenancePeriod
};