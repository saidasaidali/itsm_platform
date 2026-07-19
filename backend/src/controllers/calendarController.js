// backend/src/controllers/calendarController.js
import pool from '../db.js';
import { t } from '../utils/i18n.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { notifyEventCreated, notifyEventUpdated, notifyEventDeleted } from '../services/calendarSyncService.js';

// GET /api/calendar/events
export const getEvents = asyncHandler(async (req, res) => {
  const { role, id: userId } = req.user;
  const { start, end, type, status, assigned_to, ticket_id, asset_id } = req.query;

  let query = `
    SELECT ce.*, u.username AS created_by_name
    FROM calendar_events ce
    JOIN users u ON ce.created_by = u.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 0;

  if (start) { params.push(start); query += ` AND ce.start_date >= $${++paramCount}`; }
  if (end) { params.push(end); query += ` AND ce.end_date <= $${++paramCount}`; }
  if (type) { params.push(type); query += ` AND ce.event_type = $${++paramCount}`; }
  if (status) { params.push(status); query += ` AND ce.status = $${++paramCount}`; }
  if (ticket_id) { params.push(ticket_id); query += ` AND ce.ticket_id = $${++paramCount}`; }
  if (asset_id) { params.push(asset_id); query += ` AND ce.asset_id = $${++paramCount}`; }

  if (role === 'Technicien') {
    query += ` AND (ce.assigned_to = $${++paramCount} OR ce.created_by = $${++paramCount})`;
    params.push(userId, userId);
  } else if (role === 'Agent') {
    query += ` AND ce.created_by = $${++paramCount}`;
    params.push(userId);
  }

  query += ` ORDER BY ce.start_date ASC`;
  const { rows } = await pool.query(query, params);
  return res.json({ success: true, data: rows });
});

// GET /api/calendar/events/:id
export const getEventById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  const { rows } = await pool.query(`
    SELECT ce.*, u.username AS created_by_name
    FROM calendar_events ce
    JOIN users u ON ce.created_by = u.id
    WHERE ce.id = $1
  `, [id]);

  if (!rows[0]) {
    return res.status(404).json({ success: false, message: t(req, 'event_not_found') });
  }

  const event = rows[0];
  if (role === 'Agent' && event.created_by !== userId) {
    return res.status(403).json({ success: false, message: t(req, 'access_denied') });
  }
  if (role === 'Technicien' && event.assigned_to !== userId && event.created_by !== userId) {
    return res.status(403).json({ success: false, message: t(req, 'access_denied') });
  }

  return res.json({ success: true, data: event });
});

// POST /api/calendar/events
export const createEvent = asyncHandler(async (req, res) => {
  const { role, id: userId } = req.user;
  const {
    title, description, event_type, start_date, end_date, all_day,
    color, ticket_id, asset_id, assigned_to, department, site,
    reminder_1h, reminder_1d, reminder_start, location, notes,
    is_recurring, recurrence_type, recurrence_interval, recurrence_end_date, recurrence_count,
    participants
  } = req.body;

  // Validate required fields
  if (!title || !start_date || !end_date) {
    return res.status(400).json({ success: false, message: t(req, 'missing_required_fields') });
  }

  const defaultColors = {
    'intervention_technique': '#dc3545',
    'maintenance_preventive': '#28a745',
    'maintenance_corrective': '#ffc107',
    'deploiement': '#17a2b8',
    'installation_equipement': '#6f42c1',
    'reunion': '#007bff',
    'formation': '#20c997',
    'incident_critique': '#dc3545',
    'astreinte': '#fd7e14',
    'autre': '#6c757d'
  };

  // Validate recurrence fields
  if (is_recurring && !recurrence_type) {
    return res.status(400).json({ success: false, message: t(req, 'recurrence_type_required') });
  }

  let event;
  try {
    // Build recurrence_pattern JSONB from individual fields
    const recurrencePattern = is_recurring ? JSON.stringify({
      type: recurrence_type || null,
      interval: recurrence_interval || 1,
      end_date: recurrence_end_date || null,
      count: recurrence_count || null
    }) : null;

    const { rows } = await pool.query(`
      INSERT INTO calendar_events (
        title, description, event_type, start_date, end_date, all_day,
        color, ticket_id, asset_id, assigned_to, created_by,
        department, site, reminder_1h, reminder_1d, reminder_1w, reminder_start,
        is_recurring, recurrence_pattern, location, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      title, description, event_type || 'autre', start_date, end_date, all_day || false,
      color || defaultColors[event_type] || '#6c757d',
      ticket_id ? parseInt(ticket_id) : null,
      asset_id ? parseInt(asset_id) : null,
      assigned_to ? parseInt(assigned_to) : null,
      userId, department || null, site || null,
      reminder_1h !== false, reminder_1d !== false, false, reminder_start === true,
      is_recurring || false, recurrencePattern,
      location || null, notes || null
    ]);
    event = rows[0];
  } catch (dbError) {
    console.error('[CalendarController] createEvent DB error:', dbError.message, dbError.stack);
    return res.status(500).json({ success: false, message: t(req, 'internal_server_error') });
  }

  // Add participants if provided
  if (participants && Array.isArray(participants)) {
    for (const participantUserId of participants) {
      await pool.query(`
        INSERT INTO calendar_event_participants (event_id, user_id, role, status)
        VALUES ($1, $2, 'attendee', 'pending')
        ON CONFLICT (event_id, user_id) DO NOTHING
      `, [event.id, participantUserId]);
    }
  }

  // Notifier les clients SSE
  notifyEventCreated(event);

  return res.status(201).json({ success: true, message: t(req, 'event_created'), data: event });
});

// PUT /api/calendar/events/:id
export const updateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  const { rows: existing } = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [id]);
  if (!existing[0]) {
    return res.status(404).json({ success: false, message: t(req, 'event_not_found') });
  }

  if (role !== 'Admin' && existing[0].created_by !== userId) {
    return res.status(403).json({ success: false, message: t(req, 'access_denied') });
  }

  const { title, description, event_type, start_date, end_date, all_day, status, color, ticket_id, asset_id, assigned_to, department, site, reminder_1h, reminder_1d, reminder_start, location, notes, is_recurring, recurrence_type, recurrence_interval, recurrence_end_date, recurrence_count, participants } = req.body;

  // Build recurrence_pattern JSONB from individual fields if provided
  const recurrencePattern = is_recurring !== undefined
    ? JSON.stringify({
        type: recurrence_type || null,
        interval: recurrence_interval || 1,
        end_date: recurrence_end_date || null,
        count: recurrence_count || null
      })
    : undefined;

  const { rows } = await pool.query(`
    UPDATE calendar_events SET
      title = COALESCE($1, title),
      description = COALESCE($2, description),
      event_type = COALESCE($3, event_type),
      start_date = COALESCE($4, start_date),
      end_date = COALESCE($5, end_date),
      all_day = COALESCE($6, all_day),
      status = COALESCE($7, status),
      color = COALESCE($8, color),
      ticket_id = COALESCE($9, ticket_id),
      asset_id = COALESCE($10, asset_id),
      assigned_to = COALESCE($11, assigned_to),
      department = COALESCE($12, department),
      site = COALESCE($13, site),
      reminder_1h = COALESCE($14, reminder_1h),
      reminder_1d = COALESCE($15, reminder_1d),
      reminder_start = COALESCE($16, reminder_start),
      location = COALESCE($17, location),
      notes = COALESCE($18, notes),
      is_recurring = COALESCE($19, is_recurring),
      recurrence_pattern = COALESCE($20::jsonb, recurrence_pattern),
      updated_at = NOW()
    WHERE id = $21
    RETURNING *
  `, [title, description, event_type, start_date, end_date, all_day, status, color, ticket_id, asset_id, assigned_to, department, site, reminder_1h, reminder_1d, reminder_start, location, notes, is_recurring, recurrencePattern, id]);

  const event = rows[0];

  // Update participants if provided
  if (participants && Array.isArray(participants)) {
    // Remove existing participants
    await pool.query('DELETE FROM calendar_event_participants WHERE event_id = $1', [id]);
    // Add new participants
    for (const participantId of participants) {
      await pool.query(`
        INSERT INTO calendar_event_participants (event_id, user_id, role, status)
        VALUES ($1, $2, 'attendee', 'pending')
      `, [id, participantId]);
    }
  }

  return res.json({ success: true, message: t(req, 'event_updated'), data: event });
});

// POST /api/calendar/events/:id/duplicate
export const duplicateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  const { rows: existing } = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [id]);
  if (!existing[0]) {
    return res.status(404).json({ success: false, message: t(req, 'event_not_found') });
  }

  if (role !== 'Admin' && existing[0].created_by !== userId) {
    return res.status(403).json({ success: false, message: t(req, 'access_denied') });
  }

  const original = existing[0];
  const { start_date, end_date, ...rest } = original;
  
  // Calculate new dates (same duration, shifted by 7 days)
  const newStart = new Date(start_date);
  newStart.setDate(newStart.getDate() + 7);
  const newEnd = new Date(end_date);
  newEnd.setDate(newEnd.getDate() + 7);

  // Don't copy recurrence
  const recurrencePattern = null;

  const { rows } = await pool.query(`
    INSERT INTO calendar_events (
      title, description, event_type, start_date, end_date, all_day,
      color, ticket_id, asset_id, assigned_to, created_by,
      department, site, reminder_1h, reminder_1d, reminder_start,
      location, notes, is_recurring, recurrence_pattern, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    RETURNING *
  `, [
    original.title + ' (copie)',
    original.description,
    original.event_type,
    newStart.toISOString(),
    newEnd.toISOString(),
    original.all_day,
    original.color,
    original.ticket_id,
    original.asset_id,
    original.assigned_to,
    userId,
    original.department,
    original.site,
    original.reminder_1h,
    original.reminder_1d,
    original.reminder_start,
    original.location,
    original.notes,
    false,
    recurrencePattern,
    'scheduled'
  ]);

  const newEvent = rows[0];

  // Copy participants
  const { rows: participants } = await pool.query(
    'SELECT user_id FROM calendar_event_participants WHERE event_id = $1',
    [id]
  );
  
  for (const p of participants) {
    await pool.query(`
      INSERT INTO calendar_event_participants (event_id, user_id, role, status)
      VALUES ($1, $2, 'attendee', 'pending')
      ON CONFLICT (event_id, user_id) DO NOTHING
    `, [newEvent.id, p.user_id]);
  }

  return res.status(201).json({ success: true, message: t(req, 'event_duplicated'), data: newEvent });
});

// DELETE /api/calendar/events/:id
export const deleteEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  const { rows: existing } = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [id]);
  if (!existing[0]) {
    return res.status(404).json({ success: false, message: t(req, 'event_not_found') });
  }

  if (role !== 'Admin' && existing[0].created_by !== userId) {
    return res.status(403).json({ success: false, message: t(req, 'access_denied') });
  }

  await pool.query('DELETE FROM calendar_events WHERE id = $1', [id]);
  
  // Notifier les clients SSE
  notifyEventDeleted(id);
  
  return res.json({ success: true, message: t(req, 'event_deleted') });
});

// GET /api/calendar/events/:id/participants
export const getEventParticipants = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await pool.query(`
    SELECT cep.*, u.username, u.email
    FROM calendar_event_participants cep
    JOIN users u ON cep.user_id = u.id
    WHERE cep.event_id = $1
    ORDER BY cep.created_at ASC
  `, [id]);

  return res.json({ success: true, data: rows });
});

// POST /api/calendar/events/:id/participants
export const addParticipant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { user_id, status } = req.body;

  const { rows } = await pool.query(`
    INSERT INTO calendar_event_participants (event_id, user_id, role, status)
    VALUES ($1, $2, 'attendee', $3)
    ON CONFLICT (event_id, user_id) DO UPDATE SET status = $3
    RETURNING *
  `, [id, user_id, status || 'pending']);

  return res.status(201).json({ success: true, message: t(req, 'participant_added'), data: rows[0] });
});

// PUT /api/calendar/events/:id/participants/:userId
export const updateParticipantStatus = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const { status } = req.body;

  if (!['pending', 'accepted', 'declined'].includes(status)) {
    return res.status(400).json({ success: false, message: t(req, 'invalid_participant_status') });
  }

  const { rows } = await pool.query(`
    UPDATE calendar_event_participants
    SET status = $1, notified_at = NOW()
    WHERE event_id = $2 AND user_id = $3
    RETURNING *
  `, [status, id, userId]);

  if (!rows[0]) {
    return res.status(404).json({ success: false, message: t(req, 'participant_not_found') });
  }

  return res.json({ success: true, message: t(req, 'participant_status_updated'), data: rows[0] });
});

// DELETE /api/calendar/events/:id/participants/:userId
export const removeParticipant = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;

  await pool.query('DELETE FROM calendar_event_participants WHERE event_id = $1 AND user_id = $2', [id, userId]);

  return res.json({ success: true, message: t(req, 'participant_removed') });
});

// GET /api/calendar/auto-events
export const getAutoEvents = asyncHandler(async (req, res) => {
  const { role, id: userId } = req.user;
  
  // Utiliser le cache si disponible
  const { getCachedAutoEvents, setCachedAutoEvents } = await import('../middlewares/calendarCacheMiddleware.js');
  const cached = getCachedAutoEvents();
  if (cached) {
    // Filtrer selon les permissions même depuis le cache
    let filteredEvents = cached;
    if (role === 'Technicien') {
      filteredEvents = cached.filter(event => 
        event.assigned_to === userId || !event.assigned_to
      );
    } else if (role === 'Agent') {
      filteredEvents = cached.filter(event => 
        event.extendedProps?.created_by === userId
      );
    }
    return res.json({ 
      success: true, 
      data: filteredEvents,
      meta: cached.meta,
      cached: true 
    });
  }

  const autoEvents = [];
  const meta = {};

  // 1. Équipements avec fin de garantie dans les 30 jours
  const warrantyQuery = `
    SELECT 
      id,
      asset_tag,
      brand,
      model,
      date_fin_garantie,
      department,
      location,
      'warranty_expiry' as event_type,
      'Fin de garantie' as title
    FROM assets
    WHERE date_fin_garantie IS NOT NULL
      AND date_fin_garantie >= CURRENT_DATE
      AND date_fin_garantie <= CURRENT_DATE + INTERVAL '30 days'
      AND status NOT IN ('Retiré', 'Hors service')
    ORDER BY date_fin_garantie ASC
  `;
  const warrantyAssets = await pool.query(warrantyQuery);
  meta.warranty_count = warrantyAssets.rows.length;
  
  for (const asset of warrantyAssets.rows) {
    autoEvents.push({
      title: `📅 Fin garantie: ${asset.asset_tag}`,
      event_type: 'warranty_expiry',
      start_date: asset.date_fin_garantie,
      end_date: asset.date_fin_garantie,
      all_day: true,
      color: '#ffc107',
      asset_id: asset.id,
      department: asset.department,
      location: asset.location,
      status: 'scheduled',
      is_auto_generated: true,
      auto_source: 'warranty',
      extendedProps: {
        description: `Le garantie de l'équipement ${asset.brand} ${asset.model} (${asset.asset_tag}) expire bientôt.`,
        asset_tag: asset.asset_tag,
        asset_brand: asset.brand,
        asset_model: asset.model,
      }
    });
  }

  // 2. Maintenances préventives (tickets de type maintenance préventive planifiés)
  const maintenanceQuery = `
    SELECT 
      t.id,
      t.title,
      t.description,
      t.due_date,
      t.assigned_to,
      t.category,
      t.priority,
      a.asset_tag,
      a.brand,
      a.model,
      u.username as assigned_name
    FROM tickets t
    LEFT JOIN assets a ON t.asset_id = a.id
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.category = 'Maintenance'
      AND t.status IN ('Nouveau', 'Assigné', 'En cours')
      AND t.due_date IS NOT NULL
      AND t.due_date >= CURRENT_DATE
      AND t.due_date <= CURRENT_DATE + INTERVAL '14 days'
    ORDER BY t.due_date ASC
  `;
  const maintenances = await pool.query(maintenanceQuery);
  
  for (const maint of maintenances.rows) {
    autoEvents.push({
      title: `🔧 Maintenance: ${maint.title}`,
      event_type: 'maintenance_preventive',
      start_date: maint.due_date,
      end_date: maint.due_date,
      all_day: true,
      color: '#28a745',
      ticket_id: maint.id,
      asset_id: maint.asset_id,
      assigned_to: maint.assigned_to,
      status: 'scheduled',
      is_auto_generated: true,
      auto_source: 'maintenance_ticket',
      extendedProps: {
        description: maint.description || `Maintenance préventive planifiée pour ${maint.asset_tag || 'équipement'}`,
        ticket_title: maint.title,
        asset_tag: maint.asset_tag,
        asset_brand: maint.brand,
        asset_model: maint.model,
        assigned_to_name: maint.assigned_name,
        priority: maint.priority,
      }
    });
  }

  // 3. Équipements avec anomalies détectées nécessitant une intervention
  const anomalyQuery = `
    SELECT 
      aa.id,
      aa.asset_id,
      aa.anomaly_type,
      aa.severity,
      aa.description,
      aa.detected_at,
      a.asset_tag,
      a.brand,
      a.model,
      a.department,
      a.location
    FROM asset_anomalies aa
    JOIN assets a ON aa.asset_id = a.id
    WHERE aa.status = 'open'
      AND a.status NOT IN ('Retiré', 'Hors service')
    ORDER BY 
      CASE aa.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      aa.detected_at DESC
    LIMIT 50
  `;
  const anomalies = await pool.query(anomalyQuery);
  
  for (const anomaly of anomalies.rows) {
    const eventDate = new Date(anomaly.detected_at);
    eventDate.setDate(eventDate.getDate() + 3); // Intervention dans 3 jours
    
    autoEvents.push({
      title: `⚠️ Anomalie: ${anomaly.asset_tag}`,
      event_type: 'anomaly_intervention',
      start_date: eventDate.toISOString(),
      end_date: eventDate.toISOString(),
      all_day: true,
      color: anomaly.severity === 'critical' ? '#dc3545' : '#fd7e14',
      asset_id: anomaly.asset_id,
      department: anomaly.department,
      location: anomaly.location,
      status: 'scheduled',
      is_auto_generated: true,
      auto_source: 'anomaly',
      extendedProps: {
        description: `Anomalie détectée: ${anomaly.description}`,
        anomaly_type: anomaly.anomaly_type,
        severity: anomaly.severity,
        asset_tag: anomaly.asset_tag,
        asset_brand: anomaly.brand,
        asset_model: anomaly.model,
      }
    });
  }

  // 4. Équipements en panne (tickets ouverts pour équipements)
  const breakdownQuery = `
    SELECT 
      t.id,
      t.title,
      t.description,
      t.created_at,
      t.priority,
      a.asset_tag,
      a.brand,
      a.model,
      a.department,
      a.location
    FROM tickets t
    JOIN assets a ON t.asset_id = a.id
    WHERE t.category = 'Matériel'
      AND t.status IN ('Nouveau', 'Assigné', 'En cours')
      AND a.status = 'En panne'
    ORDER BY 
      CASE t.priority
        WHEN 'Haute' THEN 1
        WHEN 'Moyenne' THEN 2
        ELSE 3
      END,
      t.created_at DESC
    LIMIT 30
  `;
  const breakdowns = await pool.query(breakdownQuery);
  
  for (const breakdown of breakdowns.rows) {
    const eventDate = new Date(breakdown.created_at);
    eventDate.setDate(eventDate.getDate() + 1); // Intervention le lendemain
    
    autoEvents.push({
      title: `🔴 Panne: ${breakdown.asset_tag}`,
      event_type: 'equipment_breakdown',
      start_date: eventDate.toISOString(),
      end_date: eventDate.toISOString(),
      all_day: true,
      color: '#dc3545',
      ticket_id: breakdown.id,
      asset_id: breakdown.asset_id,
      department: breakdown.department,
      location: breakdown.location,
      status: 'scheduled',
      is_auto_generated: true,
      auto_source: 'breakdown',
      extendedProps: {
        description: breakdown.description || `Équipement en panne: ${breakdown.brand} ${breakdown.model}`,
        ticket_title: breakdown.title,
        asset_tag: breakdown.asset_tag,
        asset_brand: breakdown.brand,
        asset_model: breakdown.model,
        priority: breakdown.priority,
      }
    });
  }

  // Filtrer selon les permissions
  let filteredEvents = autoEvents;
  if (role === 'Technicien') {
    filteredEvents = autoEvents.filter(event => 
      event.assigned_to === userId || !event.assigned_to
    );
  } else if (role === 'Agent') {
    filteredEvents = autoEvents.filter(event => 
      event.extendedProps?.created_by === userId
    );
  }

  return res.json({ 
    success: true, 
    data: filteredEvents,
    meta: {
      warranty_count: warrantyAssets.rows.length,
      maintenance_count: maintenances.rows.length,
      anomaly_count: anomalies.rows.length,
      breakdown_count: breakdowns.rows.length,
    }
  });
});

// GET /api/calendar/stats
export const getStats = asyncHandler(async (req, res) => {
  const { role, id: userId } = req.user;
  
  // Utiliser le cache si disponible
  const { getCachedStats, setCachedStats } = await import('../middlewares/calendarCacheMiddleware.js');
  const cached = getCachedStats(userId, role);
  if (cached) {
    return res.json({ success: true, data: cached, cached: true });
  }

  // Requête optimisée avec une seule jointure et COUNT avec CASE
  const { rows } = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE DATE(start_date) = CURRENT_DATE AND status NOT IN ('cancelled', 'completed')) as today,
      COUNT(*) FILTER (WHERE start_date >= DATE_TRUNC('week', CURRENT_DATE) 
                       AND start_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'
                       AND status NOT IN ('cancelled', 'completed')) as this_week,
      COUNT(*) FILTER (WHERE event_type IN ('maintenance_preventive', 'maintenance_corrective') 
                       AND start_date >= NOW()
                       AND status NOT IN ('cancelled', 'completed')) as maintenance,
      COUNT(*) FILTER (WHERE start_date >= NOW() 
                       AND event_type = 'intervention_technique'
                       AND status NOT IN ('cancelled', 'completed')) as upcoming
    FROM calendar_events
    WHERE 
      ${role === 'Technicien' ? `(assigned_to = $1 OR created_by = $1)` : 
        role === 'Agent' ? `created_by = $1` : '1=1'}
  `, role === 'Admin' ? [] : [userId]);

  const stats = {
    today: parseInt(rows[0].today) || 0,
    thisWeek: parseInt(rows[0].this_week) || 0,
    maintenance: parseInt(rows[0].maintenance) || 0,
    upcoming: parseInt(rows[0].upcoming) || 0
  };

  // Mettre en cache
  setCachedStats(userId, role, stats);

  return res.json({ success: true, data: stats });
});