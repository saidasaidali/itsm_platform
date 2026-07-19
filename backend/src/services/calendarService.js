// backend/src/services/calendarService.js
// Service pour les opérations CRUD du calendrier
import pool from '../db.js'

/**
 * Créer un événement
 */
export async function createEvent(eventData) {
  const {
    title,
    description,
    event_type,
    start_date,
    end_date,
    all_day = false,
    status = 'scheduled',
    color,
    ticket_id = null,
    asset_id = null,
    assigned_to = null,
    created_by,
    department = '',
    site = '',
    location = '',
    notes = '',
    reminder_1w = false,
    reminder_1d = true,
    reminder_1h = true,
    reminder_start = false,
    is_recurring = false,
    recurrence_pattern = null,
    participants = [],
    participantStatuses = {},
  } = eventData

  const query = `
    INSERT INTO calendar_events (
      title, description, event_type, start_date, end_date, all_day,
      status, color, ticket_id, asset_id, assigned_to, created_by,
      department, site, location, notes,
      reminder_1w, reminder_1d, reminder_1h, reminder_start,
      is_recurring, recurrence_pattern
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    RETURNING *
  `

  const values = [
    title,
    description,
    event_type,
    start_date,
    end_date,
    all_day,
    status,
    color,
    ticket_id,
    asset_id,
    assigned_to,
    created_by,
    department,
    site,
    location,
    notes,
    reminder_1w,
    reminder_1d,
    reminder_1h,
    reminder_start,
    is_recurring,
    recurrence_pattern ? JSON.stringify(recurrence_pattern) : null,
  ]

  const { rows } = await pool.query(query, values)
  return rows[0]
}

/**
 * Mettre à jour un événement
 */
export async function updateEvent(eventId, eventData) {
  const {
    title,
    description,
    event_type,
    start_date,
    end_date,
    all_day,
    status,
    color,
    ticket_id,
    asset_id,
    assigned_to,
    department,
    site,
    location,
    notes,
    reminder_1w,
    reminder_1d,
    reminder_1h,
    reminder_start,
    is_recurring,
    recurrence_pattern,
  } = eventData

  const query = `
    UPDATE calendar_events
    SET
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
      location = COALESCE($14, location),
      notes = COALESCE($15, notes),
      reminder_1w = COALESCE($16, reminder_1w),
      reminder_1d = COALESCE($17, reminder_1d),
      reminder_1h = COALESCE($18, reminder_1h),
      reminder_start = COALESCE($19, reminder_start),
      is_recurring = COALESCE($20, is_recurring),
      recurrence_pattern = COALESCE($21, recurrence_pattern),
      updated_at = NOW()
    WHERE id = $22
    RETURNING *
  `

  const values = [
    title,
    description,
    event_type,
    start_date,
    end_date,
    all_day,
    status,
    color,
    ticket_id,
    asset_id,
    assigned_to,
    department,
    site,
    location,
    notes,
    reminder_1w,
    reminder_1d,
    reminder_1h,
    reminder_start,
    is_recurring,
    recurrence_pattern ? JSON.stringify(recurrence_pattern) : null,
    eventId,
  ]

  const { rows } = await pool.query(query, values)
  return rows[0]
}

/**
 * Supprimer un événement
 */
export async function deleteEvent(eventId) {
  const query = 'DELETE FROM calendar_events WHERE id = $1 RETURNING id'
  const { rows } = await pool.query(query, [eventId])
  return rows[0]
}

/**
 * Récupérer un événement par ID
 */
export async function getEventById(eventId) {
  const query = 'SELECT * FROM calendar_events WHERE id = $1'
  const { rows } = await pool.query(query, [eventId])
  return rows[0]
}

/**
 * Récupérer tous les événements avec filtres
 */
export async function getEvents(filters = {}) {
  const {
    start,
    end,
    type,
    status,
    assigned_to,
    ticket_id,
    asset_id,
    search,
  } = filters

  let query = `
    SELECT ce.*, 
      u.username as assigned_name,
      a.asset_tag,
      t.title as ticket_title
    FROM calendar_events ce
    LEFT JOIN users u ON ce.assigned_to = u.id
    LEFT JOIN assets a ON ce.asset_id = a.id
    LEFT JOIN tickets t ON ce.ticket_id = t.id
    WHERE 1=1
  `

  const values = []
  let paramCount = 0

  if (start) {
    paramCount++
    query += ` AND ce.start_date >= $${paramCount}`
    values.push(start)
  }

  if (end) {
    paramCount++
    query += ` AND ce.start_date < $${paramCount}`
    values.push(end)
  }

  if (type) {
    paramCount++
    query += ` AND ce.event_type = $${paramCount}`
    values.push(type)
  }

  if (status) {
    paramCount++
    query += ` AND ce.status = $${paramCount}`
    values.push(status)
  }

  if (assigned_to) {
    paramCount++
    query += ` AND ce.assigned_to = $${paramCount}`
    values.push(assigned_to)
  }

  if (ticket_id) {
    paramCount++
    query += ` AND ce.ticket_id = $${paramCount}`
    values.push(ticket_id)
  }

  if (asset_id) {
    paramCount++
    query += ` AND ce.asset_id = $${paramCount}`
    values.push(asset_id)
  }

  if (search) {
    paramCount++
    query += ` AND (ce.title ILIKE $${paramCount} OR ce.description ILIKE $${paramCount})`
    values.push(`%${search}%`)
  }

  query += ' ORDER BY ce.start_date ASC'

  const { rows } = await pool.query(query, values)
  return rows
}

/**
 * Dupliquer un événement
 */
export async function duplicateEvent(eventId) {
  const original = await getEventById(eventId)
  if (!original) {
    throw new Error('Événement non trouvé')
  }

  const { id, created_at, updated_at, ...eventData } = original
  const newEvent = {
    ...eventData,
    title: `${original.title} (copie)`,
    start_date: new Date(original.start_date),
    end_date: new Date(original.end_date),
  }

  return await createEvent(newEvent)
}

/**
 * Récupérer les participants d'un événement
 */
export async function getEventParticipants(eventId) {
  const query = `
    SELECT ep.*, u.username, u.email
    FROM calendar_event_participants ep
    JOIN users u ON ep.user_id = u.id
    WHERE ep.event_id = $1
    ORDER BY ep.created_at ASC
  `
  const { rows } = await pool.query(query, [eventId])
  return rows
}

/**
 * Ajouter un participant à un événement
 */
export async function addParticipant(eventId, userId, role = 'attendee') {
  const query = `
    INSERT INTO calendar_event_participants (event_id, user_id, role, status)
    VALUES ($1, $2, $3, 'pending')
    ON CONFLICT (event_id, user_id) DO UPDATE
    SET role = EXCLUDED.role
    RETURNING *
  `
  const { rows } = await pool.query(query, [eventId, userId, role])
  return rows[0]
}

/**
 * Mettre à jour le statut d'un participant
 */
export async function updateParticipantStatus(eventId, userId, status) {
  const query = `
    UPDATE calendar_event_participants
    SET status = $1, notified_at = NOW()
    WHERE event_id = $2 AND user_id = $3
    RETURNING *
  `
  const { rows } = await pool.query(query, [status, eventId, userId])
  return rows[0]
}

/**
 * Récupérer les statistiques du calendrier
 */
export async function getStats() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const [todayCount, weekCount, monthCount, totalCount] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) FROM calendar_events WHERE start_date >= $1 AND start_date < $2 AND status NOT IN ('cancelled', 'completed')`,
      [todayStart.toISOString(), todayEnd.toISOString()]
    ),
    pool.query(
      `SELECT COUNT(*) FROM calendar_events WHERE start_date >= $1 AND start_date < $2 AND status NOT IN ('cancelled', 'completed')`,
      [weekStart.toISOString(), weekEnd.toISOString()]
    ),
    pool.query(
      `SELECT COUNT(*) FROM calendar_events WHERE start_date >= $1 AND status NOT IN ('cancelled', 'completed')`,
      [weekStart.toISOString()]
    ),
    pool.query(
      `SELECT COUNT(*) FROM calendar_events WHERE status NOT IN ('cancelled', 'completed')`
    ),
  ])

  return {
    today: parseInt(todayCount.rows[0].count),
    thisWeek: parseInt(weekCount.rows[0].count),
    thisMonth: parseInt(monthCount.rows[0].count),
    total: parseInt(totalCount.rows[0].count),
  }
}

/**
 * Récupérer les événements auto-générés
 */
export async function getAutoEvents() {
  const query = `
    SELECT *
    FROM calendar_events
    WHERE is_auto_generated = true
      AND start_date >= NOW()
      AND status NOT IN ('cancelled', 'completed')
    ORDER BY start_date ASC
  `
  const { rows } = await pool.query(query)
  return rows
}

export default {
  createEvent,
  updateEvent,
  deleteEvent,
  getEventById,
  getEvents,
  duplicateEvent,
  getEventParticipants,
  addParticipant,
  updateParticipantStatus,
  getStats,
  getAutoEvents,
}