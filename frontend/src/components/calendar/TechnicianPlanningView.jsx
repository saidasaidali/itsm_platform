// frontend/src/components/calendar/TechnicianPlanningView.jsx
// Composant de planning des techniciens

import React, { useState, useEffect, useCallback, useContext } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CFormSelect,
  CSpinner,
  CAlert,
  CBadge,
  CProgress,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CTooltip,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilPeople,
  cilClock,
  cilWarning,
  cilCalendar,
  cilList,
  cilCheckAlt,
  cilUser,
  cilSpeedometer,
  cilSync,
} from '@coreui/icons'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../auth/AuthProvider'
import {
  getAllTechniciansPlanning,
  getMyPlanning,
  PLANNING_PERIODS,
} from '../../services/planningService'

// Couleurs pour le taux d'occupation
const getOccupancyColor = (rate) => {
  if (rate >= 80) return 'danger'
  if (rate >= 60) return 'warning'
  if (rate >= 30) return 'success'
  return 'secondary'
}

const getOccupancyBg = (rate) => {
  if (rate >= 80) return '#f8d7da'
  if (rate >= 60) return '#fff3cd'
  if (rate >= 30) return '#d4edda'
  return '#e2e3e5'
}

const getOccupancyBarColor = (rate) => {
  if (rate >= 80) return 'danger'
  if (rate >= 60) return 'warning'
  if (rate >= 30) return 'success'
  return 'secondary'
}

const TechnicianPlanningView = () => {
  const { t, i18n } = useTranslation()
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role
  const userId = currentUser?.id

  const [plannings, setPlannings] = useState([])
  const [myPlanning, setMyPlanning] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('week')
  const [selectedTech, setSelectedTech] = useState(null)

  const isAdmin = role === 'Admin'

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Charger les données en parallèle
      const [planningData, myData] = await Promise.all([
        isAdmin ? getAllTechniciansPlanning(period) : Promise.resolve([]),
        getMyPlanning(period),
      ])

      setPlannings(planningData || [])
      setMyPlanning(myData)

      // Si pas admin, on affiche que son planning
      if (!isAdmin && myData) {
        setSelectedTech({
          technician: {
            id: userId,
            username: currentUser?.username,
          },
          stats: myData,
        })
      }
    } catch (err) {
      console.error('[PlanningView] Erreur chargement:', err)
      setError(t('calendar.list.load_error'))
      setPlannings([])
      setMyPlanning(null)
    } finally {
      setLoading(false)
    }
  }, [period, isAdmin, userId, currentUser, t])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      await loadData()
      if (!cancelled) {
        // loadData already sets loading to false
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [loadData])

  const handlePeriodChange = (e) => {
    setPeriod(e.target.value)
    setSelectedTech(null)
  }

  const handleSelectTechnician = (planning) => {
    if (selectedTech?.technician?.id === planning.technician.id) {
      setSelectedTech(null)
    } else {
      setSelectedTech(planning)
    }
  }

  // Stats globales de l'équipe
  const teamStats = {
    total: plannings.length,
    available: plannings.filter((p) => p.stats.occupancyRate < 50).length,
    busy: plannings.filter((p) => p.stats.occupancyRate >= 50 && p.stats.occupancyRate < 80).length,
    overloaded: plannings.filter((p) => p.stats.occupancyRate >= 80).length,
    avgOccupancy:
      plannings.length > 0
        ? Math.round(
            plannings.reduce((sum, p) => sum + p.stats.occupancyRate, 0) / plannings.length,
          )
        : 0,
    totalConflicts: plannings.reduce((sum, p) => sum + p.stats.conflicts.length, 0),
  }

  const displayPlanning = selectedTech || (plannings.length > 0 ? plannings[0] : null)

  if (loading) {
    return (
      <div className="text-center p-5">
        <CSpinner color="primary" />
        <p className="mt-3">Chargement du planning...</p>
      </div>
    )
  }

  if (error) {
    return (
      <CAlert color="danger">
        {error}
        <CButton color="secondary" size="sm" className="ms-2" onClick={loadData}>
          <CIcon icon={cilSync} className="me-1" />
          Réessayer
        </CButton>
      </CAlert>
    )
  }

  // Message si aucun planning disponible
  if (!displayPlanning) {
    return (
      <CCard>
        <CCardBody className="text-center p-5">
          <CIcon icon={cilCalendar} size="3xl" className="mb-3 opacity-50" />
          <h5 className="text-muted">Aucune donnée de planning disponible</h5>
          <p className="text-muted mb-3">
            {isAdmin
              ? 'Aucun technicien actif trouvé ou aucun événement planifié.'
              : 'Vous n\'avez aucun événement planifié pour cette période.'}
          </p>
          <CButton color="primary" onClick={loadData}>
            <CIcon icon={cilSync} className="me-1" />
            Actualiser
          </CButton>
        </CCardBody>
      </CCard>
    )
  }

  return (
    <div className="planning-view">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="mb-0">
          <CIcon icon={cilPeople} className="me-2" />
          {t('planning.title')}
        </h5>
        <div className="d-flex align-items-center gap-2">
          <CFormSelect value={period} onChange={handlePeriodChange} style={{ width: '150px' }}>
            {Object.entries(PLANNING_PERIODS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </CFormSelect>
        </div>
      </div>

      {/* Stats Équipe */}
      {isAdmin && plannings.length > 0 && (
        <CRow className="g-3 mb-4">
          <CCol xs={6} sm={4} md={2}>
            <CCard className="text-center border-primary">
              <CCardBody className="p-2">
                <div className="small text-muted text-uppercase">{t('planning.team_total')}</div>
                <div className="fs-4 fw-semibold text-primary">{teamStats.total}</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={6} sm={4} md={2}>
            <CCard className="text-center border-success">
              <CCardBody className="p-2">
                <div className="small text-muted text-uppercase">
                  {t('planning.available_techs')}
                </div>
                <div className="fs-4 fw-semibold text-success">{teamStats.available}</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={6} sm={4} md={2}>
            <CCard className="text-center border-warning">
              <CCardBody className="p-2">
                <div className="small text-muted text-uppercase">{t('planning.busy_techs')}</div>
                <div className="fs-4 fw-semibold text-warning">{teamStats.busy}</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={6} sm={4} md={2}>
            <CCard className="text-center border-danger">
              <CCardBody className="p-2">
                <div className="small text-muted text-uppercase">
                  {t('planning.overloaded_techs')}
                </div>
                <div className="fs-4 fw-semibold text-danger">{teamStats.overloaded}</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={6} sm={4} md={2}>
            <CCard className="text-center border-info">
              <CCardBody className="p-2">
                <div className="small text-muted text-uppercase">{t('planning.avg_occupancy')}</div>
                <div className="fs-4 fw-semibold text-info">{teamStats.avgOccupancy}%</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={6} sm={4} md={2}>
            <CCard className="text-center border-warning">
              <CCardBody className="p-2">
                <div className="small text-muted text-uppercase">{t('planning.conflicts')}</div>
                <div className="fs-4 fw-semibold text-warning">{teamStats.totalConflicts}</div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      )}

      {/* Liste des techniciens (Admin seulement) */}
      {isAdmin && plannings.length > 0 && (
        <CCard className="mb-4">
          <CCardHeader>
            <CIcon icon={cilList} className="me-2" />
            {t('planning.technicians_list')}
          </CCardHeader>
          <CCardBody className="p-0">
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>{t('planning.technician')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('planning.planned_hours')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('planning.available_hours')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('planning.occupancy')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('planning.conflicts')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('planning.events')}</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {plannings.map((p) => {
                  const s = p.stats
                  const isSelected = selectedTech?.technician?.id === p.technician.id
                  return (
                    <CTableRow
                      key={p.technician.id}
                      onClick={() => handleSelectTechnician(p)}
                      className={isSelected ? 'table-active' : ''}
                      style={{ cursor: 'pointer' }}
                    >
                      <CTableDataCell>
                        <CIcon icon={cilUser} className="me-2" />
                        {p.technician.username}
                      </CTableDataCell>
                      <CTableDataCell>{s.plannedHours}h</CTableDataCell>
                      <CTableDataCell>{s.availableHours}h</CTableDataCell>
                      <CTableDataCell>
                        <div className="d-flex align-items-center gap-2">
                          <div style={{ flex: 1, maxWidth: '100px' }}>
                            <CProgress
                              value={s.occupancyRate}
                              color={getOccupancyBarColor(s.occupancyRate)}
                              height={8}
                            />
                          </div>
                          <CBadge color={getOccupancyColor(s.occupancyRate)} shape="rounded-pill">
                            {s.occupancyRate}%
                          </CBadge>
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>
                        {s.conflicts.length > 0 ? (
                          <CBadge color="warning" shape="rounded-pill">
                            {s.conflicts.length}
                          </CBadge>
                        ) : (
                          <CIcon icon={cilCheckAlt} className="text-success" />
                        )}
                      </CTableDataCell>
                      <CTableDataCell>{s.events.length}</CTableDataCell>
                      <CTableDataCell>
                        <CButton
                          color={isSelected ? 'primary' : 'secondary'}
                          size="sm"
                          variant={isSelected ? '' : 'ghost'}
                        >
                          {isSelected ? t('calendar.views.day') : t('planning.view')}
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      )}

      {/* Détail du planning sélectionné */}
      {displayPlanning && displayPlanning.stats && (
        <>
          <CCard className="mb-4">
            <CCardHeader>
              <CIcon icon={cilCalendar} className="me-2" />
              {displayPlanning.technician.username} -{' '}
              {period === 'day'
                ? t('planning.detail_today')
                : period === 'week'
                  ? t('planning.detail_week')
                  : t('planning.detail_month')}
            </CCardHeader>
            <CCardBody>
              <CRow className="g-3 mb-3">
                <CCol xs={6} md={3}>
                  <div className="d-flex flex-column">
                    <small className="text-muted">{t('planning.planned_hours')}</small>
                    <strong className="fs-5">{displayPlanning.stats.plannedHours}h</strong>
                  </div>
                </CCol>
                <CCol xs={6} md={3}>
                  <div className="d-flex flex-column">
                    <small className="text-muted">{t('planning.available_hours')}</small>
                    <strong className="fs-5">{displayPlanning.stats.availableHours}h</strong>
                  </div>
                </CCol>
                <CCol xs={6} md={3}>
                  <div className="d-flex flex-column">
                    <small className="text-muted">{t('planning.free_hours')}</small>
                    <strong className="fs-5">{displayPlanning.stats.freeHours}h</strong>
                  </div>
                </CCol>
                <CCol xs={6} md={3}>
                  <div className="d-flex flex-column">
                    <small className="text-muted">{t('planning.occupancy')}</small>
                    <strong className="fs-5">
                      <CBadge
                        color={getOccupancyColor(displayPlanning.stats.occupancyRate)}
                        size="lg"
                      >
                        {displayPlanning.stats.occupancyRate}%
                      </CBadge>
                    </strong>
                  </div>
                </CCol>
              </CRow>

              {/* Barre de progression globale */}
              <div className="mb-3">
                <div className="d-flex justify-content-between small mb-1">
                  <span>{t('planning.occupancy')}</span>
                  <span className="fw-semibold">{displayPlanning.stats.occupancyRate}%</span>
                </div>
                <CProgress
                  value={displayPlanning.stats.occupancyRate}
                  color={getOccupancyBarColor(displayPlanning.stats.occupancyRate)}
                  height={12}
                >
                  <div className="d-flex justify-content-center small text-white fw-semibold">
                    {displayPlanning.stats.plannedHours}h / {displayPlanning.stats.availableHours}h
                  </div>
                </CProgress>
              </div>

              {/* Répartition journalière */}
              {displayPlanning.stats.dailyBreakdown &&
                displayPlanning.stats.dailyBreakdown.length > 0 && (
                  <div className="mt-4">
                    <h6 className="fw-semibold mb-2">
                      <CIcon icon={cilList} className="me-2" />
                      {t('planning.daily_breakdown')}
                    </h6>
                    <CTable bordered size="sm" responsive>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>{t('planning.day')}</CTableHeaderCell>
                          <CTableHeaderCell>{t('planning.planned_hours')}</CTableHeaderCell>
                          <CTableHeaderCell>{t('planning.available_hours')}</CTableHeaderCell>
                          <CTableHeaderCell>{t('planning.occupancy')}</CTableHeaderCell>
                          <CTableHeaderCell>{t('planning.events_count')}</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {displayPlanning.stats.dailyBreakdown.map((day) => (
                          <CTableRow key={day.date}>
                            <CTableDataCell className="text-capitalize">
                              {day.dayName}
                            </CTableDataCell>
                            <CTableDataCell>{day.plannedHours}h</CTableDataCell>
                            <CTableDataCell>{day.availableHours}h</CTableDataCell>
                            <CTableDataCell>
                              <div className="d-flex align-items-center gap-2">
                                <CProgress
                                  value={day.occupancyPercent}
                                  color={getOccupancyBarColor(day.occupancyPercent)}
                                  height={6}
                                  style={{ width: '60px' }}
                                />
                                <CBadge
                                  color={getOccupancyColor(day.occupancyPercent)}
                                  shape="rounded-pill"
                                >
                                  {day.occupancyPercent}%
                                </CBadge>
                              </div>
                            </CTableDataCell>
                            <CTableDataCell>{day.eventsCount}</CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  </div>
                )}

              {/* Conflits */}
              {displayPlanning.stats.conflicts && displayPlanning.stats.conflicts.length > 0 && (
                <div className="mt-4">
                  <h6 className="fw-semibold mb-2 text-warning">
                    <CIcon icon={cilWarning} className="me-2" />
                    {t('planning.conflicts_detected')} ({displayPlanning.stats.conflicts.length})
                  </h6>
                  <CTable bordered size="sm" responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>{t('planning.date')}</CTableHeaderCell>
                        <CTableHeaderCell>{t('planning.event1')}</CTableHeaderCell>
                        <CTableHeaderCell>{t('planning.event2')}</CTableHeaderCell>
                        <CTableHeaderCell>{t('planning.overlap')}</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {displayPlanning.stats.conflicts.map((c, i) => (
                        <CTableRow key={i}>
                          <CTableDataCell>
                            {new Date(c.date).toLocaleDateString(i18n.language)}
                          </CTableDataCell>
                          <CTableDataCell>{c.event1}</CTableDataCell>
                          <CTableDataCell>{c.event2}</CTableDataCell>
                          <CTableDataCell className="text-danger">
                            {c.overlap_minutes} min
                          </CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </div>
              )}

              {/* Tickets en attente */}
              {displayPlanning.stats.pendingTickets &&
                displayPlanning.stats.pendingTickets.length > 0 && (
                  <div className="mt-4">
                    <h6 className="fw-semibold mb-2 text-info">
                      <CIcon icon={cilList} className="me-2" />
                      {t('planning.pending_tickets')} ({displayPlanning.stats.pendingTickets.length}
                      )
                    </h6>
                    <CTable bordered size="sm" responsive>
                      <CTableHead>
                        <CTableRow>
                          <CTableHeaderCell>#</CTableHeaderCell>
                          <CTableHeaderCell>{t('planning.ticket_title')}</CTableHeaderCell>
                          <CTableHeaderCell>{t('planning.priority')}</CTableHeaderCell>
                          <CTableHeaderCell>{t('planning.due_date')}</CTableHeaderCell>
                          <CTableHeaderCell>{t('planning.urgency')}</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {displayPlanning.stats.pendingTickets.map((ticket) => (
                          <CTableRow key={ticket.id}>
                            <CTableDataCell>#{ticket.id}</CTableDataCell>
                            <CTableDataCell>{ticket.title}</CTableDataCell>
                            <CTableDataCell>
                              <CBadge
                                color={
                                  ticket.priority === 'Haute'
                                    ? 'danger'
                                    : ticket.priority === 'Moyenne'
                                      ? 'warning'
                                      : 'success'
                                }
                              >
                                {ticket.priority}
                              </CBadge>
                            </CTableDataCell>
                            <CTableDataCell>
                              {new Date(ticket.due_date).toLocaleDateString(i18n.language)}
                            </CTableDataCell>
                            <CTableDataCell>
                              <CBadge
                                color={
                                  ticket.urgency === 'high'
                                    ? 'danger'
                                    : ticket.urgency === 'medium'
                                      ? 'warning'
                                      : 'secondary'
                                }
                              >
                                {ticket.urgency === 'high'
                                  ? t('planning.urgent')
                                  : ticket.urgency === 'medium'
                                    ? t('planning.medium')
                                    : t('planning.low')}
                              </CBadge>
                            </CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  </div>
                )}
            </CCardBody>
          </CCard>
        </>
      )}
    </div>
  )
}

export default TechnicianPlanningView