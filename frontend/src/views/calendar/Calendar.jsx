import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  memo,
  Suspense,
  lazy,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CAlert,
  CSpinner,
  CFormSelect,
  CFormCheck,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilCalendar, cilList, cilGrid, cilPeople, cilChart } from '@coreui/icons'
import { useTranslation } from 'react-i18next'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import frLocale from '@fullcalendar/core/locales/fr'
import arLocale from '@fullcalendar/core/locales/ar'

import { AuthContext } from '../../auth/AuthProvider'
import usePageTitle from '../../utils/usePageTitle'
import {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  duplicateEvent,
  getStats,
  getEventParticipants,
  getAutoEvents,
  EVENT_TYPES,
  EVENT_STATUSES,
} from '../../services/calendarService'
import calendarSyncClient from '../../services/calendarSyncClient'
import { getAuthToken } from '../../services/authService'

// Lazy loading des composants pour optimiser le chargement initial
const CalendarFilters = React.lazy(() => import('../../components/calendar/CalendarFilters.jsx'))
const CalendarStatsCards = React.lazy(
  () => import('../../components/calendar/CalendarStatsCards.jsx'),
)
const CalendarLegend = React.lazy(() => import('../../components/calendar/CalendarLegend.jsx'))
const EventFormModal = React.lazy(() => import('../../components/calendar/EventFormModal.jsx'))
const EventDetailModal = React.lazy(() => import('../../components/calendar/EventDetailModal.jsx'))
const EventDeleteModal = React.lazy(() => import('../../components/calendar/EventDeleteModal.jsx'))
const TechnicianPlanningView = React.lazy(
  () => import('../../components/calendar/TechnicianPlanningView.jsx'),
)
const CalendarDashboard = React.lazy(
  () => import('../../components/calendar/CalendarDashboard.jsx'),
)

import './Calendar.scss'

const INITIAL_FORM_DATA = {
  title: '',
  description: '',
  event_type: 'autre',
  start_date: '',
  end_date: '',
  all_day: false,
  status: 'scheduled',
  color: EVENT_TYPES.autre.color,
  ticket_id: '',
  asset_id: '',
  assigned_to: '',
  department: '',
  site: '',
  location: '',
  notes: '',
  reminder_1w: false,
  reminder_1d: true,
  reminder_1h: true,
  reminder_start: false,
  participants: [],
  participantStatuses: {},
}

const Calendar = () => {
  const { currentUser } = useContext(AuthContext)
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const role = currentUser?.role
  const userId = currentUser?.id

  usePageTitle('calendar.title')

  const [view, setView] = useState('dayGridMonth')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [eventToDelete, setEventToDelete] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
  })

  const [formData, setFormData] = useState({ ...INITIAL_FORM_DATA })
  const [submitting, setSubmitting] = useState(false)
  const [availableUsers, setAvailableUsers] = useState([])
  const [autoEvents, setAutoEvents] = useState([])
  const [showAutoEvents, setShowAutoEvents] = useState(true)
  const [showPlanning, setShowPlanning] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)

  const canCreate = role === 'Admin' || role === 'Technicien'
  const canEdit = role === 'Admin' || role === 'Technicien'
  const canDelete = role === 'Admin'

  const getCalendarLocale = () => {
    if (i18n.language === 'ar') return arLocale
    return frLocale
  }

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = {
        ...filters,
        start: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
        end: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
      }
      const data = await getEvents(params)
      const formattedEvents = data.map((event) => ({
        id: event.id.toString(),
        title: event.title,
        start: event.start_date,
        end: event.end_date,
        allDay: event.all_day,
        backgroundColor: event.color || EVENT_TYPES[event.event_type]?.color || '#6c757d',
        borderColor: event.color || EVENT_TYPES[event.event_type]?.color || '#6c757d',
        className: event.is_recurring ? 'fc-event-recurring' : '',
        extendedProps: {
          ...event,
        },
      }))
      setEvents(formattedEvents)
    } catch (err) {
      console.error('Error fetching events:', err)
      setError(t('calendar.list.load_error'))
    } finally {
      setLoading(false)
    }
  }, [filters, t])

  const fetchStats = useCallback(async () => {
    try {
      const data = await getStats()
      setStats(data)
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }, [])

  // Load available users for participants
  useEffect(() => {
    const loadUsers = async () => {
      try {
        // Import userService dynamically - use technicians endpoint (accessible to all authenticated roles)
        const { getActiveTechnicians } = await import('../../services/userService.js')
        const data = await getActiveTechnicians()
        setAvailableUsers(Array.isArray(data) ? data : (data.users || data.technicians || []))
      } catch (err) {
        console.error('Error loading users:', err)
      }
    }
    loadUsers()
  }, [])

  // Load auto-generated events
  useEffect(() => {
    const loadAutoEvents = async () => {
      try {
        const data = await getAutoEvents()
        setAutoEvents(data)
      } catch (err) {
        console.error('Error loading auto events:', err)
      }
    }
    loadAutoEvents()
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      await fetchEvents()
      await fetchStats()
    }
    load()
    return () => {
      cancelled = true
    }
  }, [fetchEvents, fetchStats])

  // Connexion SSE pour les mises à jour temps réel
  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      calendarSyncClient.connect(token)
    }

    // Écouter les événements de rafraîchissement
    const unsubscribe = calendarSyncClient.on('refresh_calendar', () => {
      console.log('[Calendar] Rafraîchissement automatique des données')
      fetchEvents()
      fetchStats()
    })

    return () => {
      unsubscribe()
      calendarSyncClient.disconnect()
    }
  }, [fetchEvents, fetchStats])

  const handleEventClick = useCallback((info) => {
    const event = info.event.extendedProps
    setSelectedEvent(event)
    setShowDetailModal(true)
  }, [])

  const handleDateSelect = useCallback(
    (selectInfo) => {
      if (!canCreate) return

      const start = selectInfo.start
      const end = selectInfo.end || selectInfo.start

      setFormData({
        ...INITIAL_FORM_DATA,
        start_date: start.toISOString().slice(0, 16),
        end_date: end.toISOString().slice(0, 16),
      })
      setEditingEvent(null)
      setShowModal(true)
    },
    [canCreate],
  )

  const handleEventDrop = useCallback(
    async (dropInfo) => {
      const event = dropInfo.event
      try {
        await updateEvent(event.id, {
          start_date: event.start.toISOString(),
          end_date: event.end ? event.end.toISOString() : event.start.toISOString(),
          all_day: event.allDay,
        })
        fetchEvents()
        fetchStats()
      } catch (err) {
        console.error('Error updating event:', err)
        dropInfo.revert()
      }
    },
    [fetchEvents, fetchStats],
  )

  const handleEventResize = useCallback(
    async (resizeInfo) => {
      const event = resizeInfo.event
      try {
        await updateEvent(event.id, {
          start_date: event.start.toISOString(),
          end_date: event.end.toISOString(),
        })
        fetchEvents()
        fetchStats()
      } catch (err) {
        console.error('Error updating event:', err)
        resizeInfo.revert()
      }
    },
    [fetchEvents, fetchStats],
  )

  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleEventTypeChange = useCallback((type) => {
    setFormData((prev) => ({
      ...prev,
      event_type: type,
      color: EVENT_TYPES[type]?.color || '#6c757d',
    }))
  }, [])

  const handleSubmit = useCallback(async () => {
    try {
      setSubmitting(true)
      const payload = {
        ...formData,
        ticket_id: formData.ticket_id ? parseInt(formData.ticket_id) : null,
        asset_id: formData.asset_id ? parseInt(formData.asset_id) : null,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null,
        participants: formData.participants || [],
        participantStatuses: formData.participantStatuses || {},
      }

      if (editingEvent) {
        await updateEvent(editingEvent.id, payload)
      } else {
        await createEvent(payload)
      }

      setShowModal(false)
      setFormData({ ...INITIAL_FORM_DATA })
      setEditingEvent(null)
      fetchEvents()
      fetchStats()
    } catch (err) {
      console.error('Error saving event:', err)
      setError(editingEvent ? t('calendar.form.update_error') : t('calendar.form.create_error'))
    } finally {
      setSubmitting(false)
    }
  }, [formData, editingEvent, fetchEvents, fetchStats, t])

  const handleEdit = useCallback(() => {
    if (!selectedEvent) return
    setFormData({
      title: selectedEvent.title || '',
      description: selectedEvent.description || '',
      event_type: selectedEvent.event_type || 'autre',
      start_date: selectedEvent.start_date
        ? new Date(selectedEvent.start_date).toISOString().slice(0, 16)
        : '',
      end_date: selectedEvent.end_date
        ? new Date(selectedEvent.end_date).toISOString().slice(0, 16)
        : '',
      all_day: selectedEvent.all_day || false,
      status: selectedEvent.status || 'scheduled',
      color: selectedEvent.color || EVENT_TYPES[selectedEvent.event_type]?.color || '#6c757d',
      ticket_id: selectedEvent.ticket_id || '',
      asset_id: selectedEvent.asset_id || '',
      assigned_to: selectedEvent.assigned_to || '',
      department: selectedEvent.department || '',
      site: selectedEvent.site || '',
      location: selectedEvent.location || '',
      notes: selectedEvent.notes || '',
      reminder_1w: selectedEvent.reminder_1w || false,
      reminder_1d: selectedEvent.reminder_1d !== false,
      reminder_1h: selectedEvent.reminder_1h !== false,
      reminder_start: selectedEvent.reminder_start === true,
    })
    setEditingEvent(selectedEvent)
    setShowDetailModal(false)
    setShowModal(true)
  }, [selectedEvent])

  const handleDelete = useCallback(async () => {
    if (!eventToDelete) return
    try {
      await deleteEvent(eventToDelete.id)
      setShowDeleteModal(false)
      setEventToDelete(null)
      setShowDetailModal(false)
      fetchEvents()
      fetchStats()
    } catch (err) {
      console.error('Error deleting event:', err)
      setError(t('calendar.form.delete_error'))
    }
  }, [eventToDelete, fetchEvents, fetchStats, t])

  const handleAddNew = useCallback(() => {
    setFormData({ ...INITIAL_FORM_DATA })
    setEditingEvent(null)
    setShowModal(true)
  }, [])

  const handleDuplicate = useCallback(async () => {
    if (!selectedEvent) return
    try {
      await duplicateEvent(selectedEvent.id)
      fetchEvents()
      fetchStats()
      setShowDetailModal(false)
    } catch (err) {
      console.error('Error duplicating event:', err)
      setError(t('calendar.form.duplicate_error'))
    }
  }, [selectedEvent, fetchEvents, fetchStats, t])

  const handleCloseFormModal = useCallback(() => {
    setShowModal(false)
    setFormData({ ...INITIAL_FORM_DATA })
    setEditingEvent(null)
  }, [])

  const handleCloseDetailModal = useCallback(() => {
    setShowDetailModal(false)
    setSelectedEvent(null)
  }, [])

  const handleCloseDeleteModal = useCallback(() => {
    setShowDeleteModal(false)
    setEventToDelete(null)
  }, [])

  const handleDeleteFromDetail = useCallback(() => {
    if (!selectedEvent) return
    setEventToDelete(selectedEvent)
    setShowDeleteModal(true)
  }, [selectedEvent])

  const calendarEvents = useMemo(() => {
    const regularEvents = events.filter((event) => {
      if (filters.type && event.extendedProps.event_type !== filters.type) return false
      if (filters.status && event.extendedProps.status !== filters.status) return false
      if (filters.search) {
        const search = filters.search.toLowerCase()
        return (
          event.title.toLowerCase().includes(search) ||
          event.extendedProps.description?.toLowerCase().includes(search) ||
          event.extendedProps.location?.toLowerCase().includes(search)
        )
      }
      return true
    })

    // Add auto-generated events if enabled
    if (showAutoEvents && autoEvents.length > 0) {
      const formattedAutoEvents = autoEvents.map((event, index) => ({
        id: `auto-${event.auto_source}-${event.asset_id || event.ticket_id || index}`,
        title: event.title,
        start: event.start_date,
        end: event.end_date,
        allDay: event.all_day,
        backgroundColor: event.color || '#6c757d',
        borderColor: event.color || '#6c757d',
        extendedProps: {
          ...event,
          is_auto_generated: true,
        },
      }))
      return [...regularEvents, ...formattedAutoEvents]
    }

    return regularEvents
  }, [events, autoEvents, showAutoEvents, filters])

  const viewButtons = useMemo(
    () => [
      { key: 'dayGridMonth', icon: cilGrid, title: t('calendar.views.month') },
      { key: 'timeGridWeek', icon: cilCalendar, title: t('calendar.views.week') },
      { key: 'timeGridDay', icon: cilList, title: t('calendar.views.day') },
    ],
    [t],
  )

  return (
    <div className="calendar-page">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">{t('calendar.title')}</h4>
        <div className="d-flex gap-2 align-items-center">
          <CFormCheck
            id="showAutoEvents"
            label={t('calendar.actions.show_auto_events')}
            checked={showAutoEvents}
            onChange={(e) => setShowAutoEvents(e.target.checked)}
          />
          <CButton
            color={showDashboard ? 'warning' : 'secondary'}
            variant={showDashboard ? '' : 'ghost'}
            onClick={() => setShowDashboard(!showDashboard)}
            title="Tableau de bord"
          >
            <CIcon icon={cilChart} className="me-2" />
            Dashboard
          </CButton>
          <CButton
            color={showPlanning ? 'info' : 'secondary'}
            variant={showPlanning ? '' : 'ghost'}
            onClick={() => setShowPlanning(!showPlanning)}
            title={t('planning.title')}
          >
            <CIcon icon={cilPeople} className="me-2" />
            {t('planning.title')}
          </CButton>
          {canCreate && (
            <CButton color="primary" onClick={handleAddNew}>
              <CIcon icon={cilPlus} className="me-2" />
              {t('calendar.actions.add_event')}
            </CButton>
          )}
        </div>
      </div>

      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          {error}
        </CAlert>
      )}

      <CRow className="g-4 mb-4">
        <Suspense
          fallback={
            <div className="text-center p-3">
              <CSpinner color="primary" size="sm" />
            </div>
          }
        >
          <CalendarStatsCards stats={stats} loading={loading} />
        </Suspense>
      </CRow>

      <CCard className="mb-4">
        <CCardHeader>
          <CRow className="g-3 align-items-center">
            <CCol md={4}>
              <Suspense
                fallback={
                  <div className="text-center p-2">
                    <CSpinner color="primary" size="sm" />
                  </div>
                }
              >
                <CalendarFilters filters={filters} onFilterChange={setFilters} />
              </Suspense>
            </CCol>
            <CCol md={3}>
              <CFormSelect
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              >
                <option value="">{t('calendar.actions.all_types')}</option>
                {Object.entries(EVENT_TYPES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {t(`calendar.types.${key}`) || value.label}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={3}>
              <CFormSelect
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">{t('calendar.actions.all_statuses')}</option>
                {Object.entries(EVENT_STATUSES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {t(`calendar.statuses.${key}`) || value}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={2} className="d-flex gap-2">
              {viewButtons.map((btn) => (
                <CButton
                  key={btn.key}
                  color={view === btn.key ? 'primary' : 'secondary'}
                  onClick={() => setView(btn.key)}
                  title={btn.title}
                >
                  <CIcon icon={btn.icon} />
                </CButton>
              ))}
            </CCol>
          </CRow>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className="text-center p-5">
              <CSpinner color="primary" />
            </div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView={view}
              events={calendarEvents}
              locale={getCalendarLocale()}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: '',
              }}
              footerToolbar={{
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
              }}
              editable={canEdit}
              selectable={canCreate}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              height="auto"
              buttonText={{
                today: t('calendar.actions.today'),
                month: t('calendar.views.month'),
                week: t('calendar.views.week'),
                day: t('calendar.views.day'),
                list: t('calendar.views.agenda'),
              }}
            />
          )}
        </CCardBody>
      </CCard>

      <CCard className="mb-4">
        <CCardBody>
          <Suspense
            fallback={
              <div className="text-center p-2">
                <CSpinner color="primary" size="sm" />
              </div>
            }
          >
            <CalendarLegend />
          </Suspense>
        </CCardBody>
      </CCard>

      {/* Event Form Modal */}
      <Suspense fallback={null}>
        <EventFormModal
          visible={showModal}
          editingEvent={editingEvent}
          formData={formData}
          submitting={submitting}
          onClose={handleCloseFormModal}
          onSubmit={handleSubmit}
          onFormChange={handleFormChange}
          onEventTypeChange={handleEventTypeChange}
          availableUsers={availableUsers}
        />
      </Suspense>

      {/* Event Detail Modal */}
      <Suspense fallback={null}>
        <EventDetailModal
          visible={showDetailModal}
          event={selectedEvent}
          canEdit={canEdit}
          canDelete={canDelete}
          onClose={handleCloseDetailModal}
          onEdit={handleEdit}
          onDelete={handleDeleteFromDetail}
          onDuplicate={handleDuplicate}
        />
      </Suspense>

      {/* Delete Confirmation Modal */}
      <Suspense fallback={null}>
        <EventDeleteModal
          visible={showDeleteModal}
          onClose={handleCloseDeleteModal}
          onConfirm={handleDelete}
        />
      </Suspense>

      {/* Vue Planning des Techniciens */}
      {showPlanning && (
        <CCard className="mt-4">
          <CCardBody>
            <Suspense
              fallback={
                <div className="text-center p-5">
                  <CSpinner color="primary" />
                </div>
              }
            >
              <TechnicianPlanningView />
            </Suspense>
          </CCardBody>
        </CCard>
      )}

      {/* Dashboard Calendrier */}
      {showDashboard && (
        <CCard className="mt-4">
          <CCardBody>
            <Suspense
              fallback={
                <div className="text-center p-5">
                  <CSpinner color="primary" />
                </div>
              }
            >
              <CalendarDashboard />
            </Suspense>
          </CCardBody>
        </CCard>
      )}
    </div>
  )
}

export default Calendar
