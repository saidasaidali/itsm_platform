// frontend/src/components/calendar/CalendarDashboard.jsx
// Tableau de bord professionnel du calendrier avec Chart.js
import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CAlert,
  CSpinner,
  CBadge,
  CTable,
  CTableBody,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
  CProgress,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilCalendar,
  cilClock,
  cilWarning,
  cilShieldAlt,
  cilPeople,
  cilChart,
  cilSync,
} from '@coreui/icons'
import ChartCard from '../../components/dashboard/ChartCard'
import KPICard from '../../components/dashboard/KPICard'
import { getCalendarDashboard } from '../../services/calendarDashboardService'

const CalendarDashboard = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getCalendarDashboard()
      // L'API retourne { success: true, data: {...} }
      if (response && response.success && response.data) {
        setDashboardData(response.data)
      } else {
        setDashboardData(null)
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err)
      setError(err.message || 'Erreur lors du chargement du tableau de bord')
      setDashboardData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      await fetchDashboard()
      if (!cancelled) {
        // fetchDashboard already sets loading to false
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [fetchDashboard])

  if (loading) {
    return (
      <div className="text-center p-5">
        <CSpinner color="primary" size="lg" />
        <p className="mt-3">Chargement du tableau de bord...</p>
      </div>
    )
  }

  if (error) {
    return (
      <CAlert color="danger">
        {error}
        <CButton color="secondary" size="sm" className="ms-2" onClick={fetchDashboard}>
          <CIcon icon={cilSync} className="me-1" />
          Réessayer
        </CButton>
      </CAlert>
    )
  }

  // Vérification de sécurité - si pas de données, on affiche un message
  if (!dashboardData) {
    return (
      <CAlert color="info">
        Aucune donnée disponible pour le tableau de bord.
        <CButton color="primary" size="sm" className="ms-2" onClick={fetchDashboard}>
          <CIcon icon={cilSync} className="me-1" />
          Actualiser
        </CButton>
      </CAlert>
    )
  }

  const data = dashboardData

  // Préparer les données pour les graphiques
  const eventsByTypeData = {
    labels: (data.eventsByType || []).map((e) => e.label),
    datasets: [
      {
        data: (data.eventsByType || []).map((e) => e.count),
        backgroundColor: [
          '#17a2b8',
          '#28a745',
          '#ffc107',
          '#dc3545',
          '#007bff',
          '#6f42c1',
          '#fd7e14',
          '#20c997',
          '#e83e8c',
          '#343a40',
        ],
      },
    ],
  }

  const weeklyTrendData = {
    labels: (data.weeklyTrend || []).map((w) => w.week),
    datasets: [
      {
        label: 'Événements',
        data: (data.weeklyTrend || []).map((w) => w.count),
        borderColor: '#007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const technicianLoadData = {
    labels: (data.technicianLoad || []).map((t) => t.username),
    datasets: [
      {
        label: 'Heures planifiées',
        data: (data.technicianLoad || []).map((t) => parseFloat(t.planned_hours) || 0),
        backgroundColor: '#007bff',
      },
      {
        label: 'Tickets actifs',
        data: (data.technicianLoad || []).map((t) => t.active_tickets || 0),
        backgroundColor: '#ffc107',
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
      },
    },
  }

  return (
    <div className="calendar-dashboard">
      {/* En-tête avec bouton de rafraîchissement */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>
          <CIcon icon={cilChart} className="me-2" />
          Tableau de bord du calendrier
        </h2>
        <CButton color="primary" onClick={fetchDashboard}>
          <CIcon icon={cilSync} className="me-1" />
          Actualiser
        </CButton>
      </div>

      {/* KPIs principaux */}
      <CRow className="mb-4">
        <CCol sm={6} md={3}>
          <KPICard
            title="Aujourd'hui"
            value={(data.today || []).length}
            subtitle="interventions"
            icon={cilCalendar}
            color="primary"
          />
        </CCol>
        <CCol sm={6} md={3}>
          <KPICard
            title="Cette semaine"
            value={(data.thisWeek || []).length}
            subtitle="interventions"
            icon={cilCalendar}
            color="info"
          />
        </CCol>
        <CCol sm={6} md={3}>
          <KPICard
            title="En retard"
            value={(data.overdue || []).length}
            subtitle="interventions"
            icon={cilWarning}
            color="danger"
          />
        </CCol>
        <CCol sm={6} md={3}>
          <KPICard
            title="SLA proches"
            value={(data.nearSLA || []).length}
            subtitle="tickets"
            icon={cilClock}
            color="warning"
          />
        </CCol>
      </CRow>

      {/* Deuxième ligne de KPIs */}
      <CRow className="mb-4">
        <CCol sm={6} md={3}>
          <KPICard
            title="Maintenances prévues"
            value={(data.upcomingMaintenances || []).length}
            subtitle="cette semaine"
            icon={cilShieldAlt}
            color="success"
          />
        </CCol>
        <CCol sm={6} md={3}>
          <KPICard
            title="Garanties expirant"
            value={(data.expiringWarranties || []).length}
            subtitle="dans 30 jours"
            icon={cilShieldAlt}
            color="warning"
          />
        </CCol>
        <CCol sm={6} md={3}>
          <KPICard
            title="Techniciens actifs"
            value={(data.technicianLoad || []).length}
            subtitle="disponibles"
            icon={cilPeople}
            color="info"
          />
        </CCol>
        <CCol sm={6} md={3}>
          <KPICard
            title="Équipes"
            value={(data.teamAvailability || []).length}
            subtitle="actives"
            icon={cilPeople}
            color="primary"
          />
        </CCol>
      </CRow>

      {/* Graphiques */}
      <CRow className="mb-4">
        <CCol md={6}>
          <ChartCard
            title="Répartition par type d'événement"
            type="doughnut"
            data={eventsByTypeData}
            options={chartOptions}
            height="300px"
          />
        </CCol>
        <CCol md={6}>
          <ChartCard
            title="Tendance hebdomadaire"
            type="line"
            data={weeklyTrendData}
            options={chartOptions}
            height="300px"
          />
        </CCol>
      </CRow>

      {/* Charge des techniciens */}
      <CRow className="mb-4">
        <CCol md={12}>
          <CCard>
            <CCardHeader>
              <strong>Charge des techniciens (7 prochains jours)</strong>
            </CCardHeader>
            <CCardBody>
              {(data.technicianLoad || []).length === 0 ? (
                <p className="text-muted">Aucun technicien disponible</p>
              ) : (
                <CTable striped hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Technicien</CTableHeaderCell>
                      <CTableHeaderCell>Division</CTableHeaderCell>
                      <CTableHeaderCell>Service</CTableHeaderCell>
                      <CTableHeaderCell>Événements</CTableHeaderCell>
                      <CTableHeaderCell>Heures planifiées</CTableHeaderCell>
                      <CTableHeaderCell>Tickets actifs</CTableHeaderCell>
                      <CTableHeaderCell>Charge</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {(data.technicianLoad || []).map((tech) => {
                      const loadPercent = Math.min(100, ((parseFloat(tech.planned_hours) || 0) / 35) * 100)
                      const loadColor =
                        loadPercent > 80 ? 'danger' : loadPercent > 60 ? 'warning' : 'success'
                      return (
                        <CTableRow key={tech.id}>
                          <CTableDataCell>{tech.username}</CTableDataCell>
                          <CTableDataCell>{tech.division || '-'}</CTableDataCell>
                          <CTableDataCell>{tech.service || '-'}</CTableDataCell>
                          <CTableDataCell>{tech.events_count}</CTableDataCell>
                          <CTableDataCell>{tech.planned_hours}h</CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={tech.active_tickets > 5 ? 'danger' : 'primary'}>
                              {tech.active_tickets}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell style={{ width: '200px' }}>
                            <CProgress value={loadPercent} color={loadColor} className="mb-1" />
                            <small>{loadPercent.toFixed(0)}%</small>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Disponibilité des équipes */}
      <CRow className="mb-4">
        <CCol md={12}>
          <CCard>
            <CCardHeader>
              <strong>Disponibilité des équipes</strong>
            </CCardHeader>
            <CCardBody>
              {(data.teamAvailability || []).length === 0 ? (
                <p className="text-muted">Aucune équipe disponible</p>
              ) : (
                <CTable striped hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Division</CTableHeaderCell>
                      <CTableHeaderCell>Service</CTableHeaderCell>
                      <CTableHeaderCell>Techniciens</CTableHeaderCell>
                      <CTableHeaderCell>Événements planifiés</CTableHeaderCell>
                      <CTableHeaderCell>Disponibilité</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {(data.teamAvailability || []).map((team) => {
                      const availability =
                        team.total_technicians > 0
                          ? ((team.total_technicians - team.busy_events) / team.total_technicians) *
                            100
                          : 0
                      const availColor =
                        availability > 70 ? 'success' : availability > 40 ? 'warning' : 'danger'
                      return (
                        <CTableRow key={`${team.division}-${team.service}`}>
                          <CTableDataCell>{team.division || '-'}</CTableDataCell>
                          <CTableDataCell>{team.service || '-'}</CTableDataCell>
                          <CTableDataCell>{team.total_technicians}</CTableDataCell>
                          <CTableDataCell>{team.busy_events}</CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={availColor}>{availability.toFixed(0)}%</CBadge>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Interventions aujourd'hui */}
      <CRow className="mb-4">
        <CCol md={12}>
          <CCard>
            <CCardHeader>
              <strong>Interventions aujourd'hui</strong>
              <CBadge color="primary" className="ms-2">
                {(data.today || []).length}
              </CBadge>
            </CCardHeader>
            <CCardBody>
              {(data.today || []).length === 0 ? (
                <p className="text-muted">Aucune intervention prévue aujourd'hui</p>
              ) : (
                <CTable striped hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Heure</CTableHeaderCell>
                      <CTableHeaderCell>Titre</CTableHeaderCell>
                      <CTableHeaderCell>Type</CTableHeaderCell>
                      <CTableHeaderCell>Technicien</CTableHeaderCell>
                      <CTableHeaderCell>Équipement</CTableHeaderCell>
                      <CTableHeaderCell>Statut</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {(data.today || []).map((event) => (
                      <CTableRow key={event.id}>
                        <CTableDataCell>
                          {new Date(event.start_date).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </CTableDataCell>
                        <CTableDataCell>{event.title}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color="info">{event.event_type}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{event.assigned_name || '-'}</CTableDataCell>
                        <CTableDataCell>{event.asset_tag || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={event.status === 'scheduled' ? 'primary' : 'success'}>
                            {event.status}
                          </CBadge>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Interventions en retard et SLA proches */}
      <CRow className="mb-4">
        <CCol md={6}>
          <CCard>
            <CCardHeader>
              <strong>Interventions en retard</strong>
              <CBadge color="danger" className="ms-2">
                {(data.overdue || []).length}
              </CBadge>
            </CCardHeader>
            <CCardBody>
              {(data.overdue || []).length === 0 ? (
                <p className="text-muted">Aucune intervention en retard</p>
              ) : (
                <CTable striped hover responsive size="sm">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Date</CTableHeaderCell>
                      <CTableHeaderCell>Titre</CTableHeaderCell>
                      <CTableHeaderCell>Technicien</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {(data.overdue || []).slice(0, 10).map((event) => (
                      <CTableRow key={event.id}>
                        <CTableDataCell>
                          {new Date(event.start_date).toLocaleDateString('fr-FR')}
                        </CTableDataCell>
                        <CTableDataCell>{event.title}</CTableDataCell>
                        <CTableDataCell>{event.assigned_name || '-'}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={6}>
          <CCard>
            <CCardHeader>
              <strong>SLA proches (24h)</strong>
              <CBadge color="warning" className="ms-2">
                {(data.nearSLA || []).length}
              </CBadge>
            </CCardHeader>
            <CCardBody>
              {(data.nearSLA || []).length === 0 ? (
                <p className="text-muted">Aucun SLA proche</p>
              ) : (
                <CTable striped hover responsive size="sm">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Échéance</CTableHeaderCell>
                      <CTableHeaderCell>Titre</CTableHeaderCell>
                      <CTableHeaderCell>Priorité</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {(data.nearSLA || []).slice(0, 10).map((ticket) => (
                      <CTableRow key={ticket.id}>
                        <CTableDataCell>
                          {new Date(ticket.due_date).toLocaleString('fr-FR')}
                        </CTableDataCell>
                        <CTableDataCell>{ticket.title}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge
                            color={
                              ticket.priority === 'Haute'
                                ? 'danger'
                                : ticket.priority === 'Moyenne'
                                  ? 'warning'
                                  : 'info'
                            }
                          >
                            {ticket.priority}
                          </CBadge>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Maintenances et garanties */}
      <CRow className="mb-4">
        <CCol md={6}>
          <CCard>
            <CCardHeader>
              <strong>Maintenances prévues (7 jours)</strong>
              <CBadge color="success" className="ms-2">
                {(data.upcomingMaintenances || []).length}
              </CBadge>
            </CCardHeader>
            <CCardBody>
              {(data.upcomingMaintenances || []).length === 0 ? (
                <p className="text-muted">Aucune maintenance prévue</p>
              ) : (
                <CTable striped hover responsive size="sm">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Date</CTableHeaderCell>
                      <CTableHeaderCell>Équipement</CTableHeaderCell>
                      <CTableHeaderCell>Type</CTableHeaderCell>
                      <CTableHeaderCell>Technicien</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {(data.upcomingMaintenances || []).slice(0, 10).map((maint) => (
                      <CTableRow key={maint.id}>
                        <CTableDataCell>
                          {new Date(maint.start_date).toLocaleDateString('fr-FR')}
                        </CTableDataCell>
                        <CTableDataCell>{maint.asset_tag || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color="info">{maint.maintenance_type || 'préventive'}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{maint.assigned_name || '-'}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={6}>
          <CCard>
            <CCardHeader>
              <strong>Garanties expirant bientôt</strong>
              <CBadge color="warning" className="ms-2">
                {(data.expiringWarranties || []).length}
              </CBadge>
            </CCardHeader>
            <CCardBody>
              {(data.expiringWarranties || []).length === 0 ? (
                <p className="text-muted">Aucune garantie expirant dans les 30 jours</p>
              ) : (
                <CTable striped hover responsive size="sm">
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Équipement</CTableHeaderCell>
                      <CTableHeaderCell>Tag</CTableHeaderCell>
                      <CTableHeaderCell>Expiration</CTableHeaderCell>
                      <CTableHeaderCell>Jours restants</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {(data.expiringWarranties || []).slice(0, 10).map((asset) => {
                      const daysLeft = Math.ceil(
                        (new Date(asset.warranty_end) - new Date()) / (1000 * 60 * 60 * 24),
                      )
                      return (
                        <CTableRow key={asset.id}>
                          <CTableDataCell>{asset.name || asset.asset_tag}</CTableDataCell>
                          <CTableDataCell>{asset.asset_tag}</CTableDataCell>
                          <CTableDataCell>
                            {new Date(asset.warranty_end).toLocaleDateString('fr-FR')}
                          </CTableDataCell>
                          <CTableDataCell>
                            <CBadge
                              color={daysLeft < 7 ? 'danger' : daysLeft < 14 ? 'warning' : 'info'}
                            >
                              {daysLeft} jours
                            </CBadge>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  )
}

export default CalendarDashboard