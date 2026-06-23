import React, { useEffect, useState, useContext, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CBadge,
  CSpinner,
} from '@coreui/react'
import { CChart } from '@coreui/react-chartjs'
import CIcon from '@coreui/icons-react'
import {
  cilPeople,
  cilClipboard,
  cilDevices,
  cilBook,
  cilWarning,
  cilBell,
  cilPlus,
} from '@coreui/icons'
import { useTranslation } from 'react-i18next'

import { AuthContext } from '../../auth/AuthProvider'
import { getTicketStats } from '../../services/ticketService'
import { getAssetCounts } from '../../services/assetService'
import { getNotifications } from '../../services/notificationService'
import { getRealtimeDashboard } from '../../services/dashboardService'
import NetworkMap from './NetworkMap'

const REFRESH_INTERVAL_MS = 20000

const Dashboard = () => {
  const { currentUser } = useContext(AuthContext)
  const { t, i18n } = useTranslation()
  const role = currentUser?.role
  const navigate = useNavigate()
  const isStaff = role === 'Admin' || role === 'Technicien'

  const [ticketStats, setTicketStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
  })
  const [assetCounts, setAssetCounts] = useState({ total: 0, inService: 0, offline: 0 })
  const [notifications, setNotifications] = useState([])
  const [realtime, setRealtime] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [initialLoading, setInitialLoading] = useState(true)

  const isFirstLoad = useRef(true)

  const fetchAll = useCallback(async () => {
    try {
      const promises = [getTicketStats(), getNotifications()]
      if (isStaff) {
        promises.push(getAssetCounts())
        promises.push(getRealtimeDashboard())
      }

      const results = await Promise.all(promises)

      setTicketStats(results[0])
      setNotifications(results[1])
      if (isStaff) {
        setAssetCounts(results[2])
        setRealtime(results[3])
      }
      setLastUpdated(new Date())
    } catch (err) {
      console.error('[Dashboard] Refresh error:', err)
    } finally {
      if (isFirstLoad.current) {
        setInitialLoading(false)
        isFirstLoad.current = false
      }
    }
  }, [isStaff])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchAll])

  const quickActions = {
    Admin: [
      { label: t('dashboard.actions.manage_users'), icon: cilPeople, color: 'primary', path: '/users' },
      { label: t('dashboard.actions.view_tickets'), icon: cilClipboard, color: 'secondary', path: '/tickets' },
      { label: t('dashboard.actions.manage_assets'), icon: cilDevices, color: 'info', path: '/assets' },
      { label: t('dashboard.actions.manage_knowledge'), icon: cilBook, color: 'success', path: '/knowledge' },
      { label: t('dashboard.actions.view_anomalies'), icon: cilWarning, color: 'warning', path: '/anomalies' },
    ],
    Technicien: [
      { label: t('dashboard.actions.assigned_tickets'), icon: cilClipboard, color: 'primary', path: '/tickets' },
      { label: t('dashboard.actions.knowledge'), icon: cilBook, color: 'info', path: '/knowledge' },
      { label: t('dashboard.actions.view_anomalies'), icon: cilWarning, color: 'warning', path: '/anomalies' },
      { label: t('dashboard.actions.my_notifications'), icon: cilBell, color: 'secondary', path: '/notifications' },
    ],
    Agent: [
      { label: t('dashboard.actions.create_ticket'), icon: cilPlus, color: 'primary', path: '/tickets/new' },
      { label: t('dashboard.actions.my_tickets'), icon: cilClipboard, color: 'secondary', path: '/tickets' },
      { label: t('dashboard.actions.knowledge'), icon: cilBook, color: 'info', path: '/knowledge' },
      { label: t('dashboard.actions.my_notifications'), icon: cilBell, color: 'light', path: '/notifications' },
    ],
  }
  const actions = quickActions[role] || []

  if (initialLoading) {
    return (
      <div className="text-center p-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">{t('dashboard.title')}</h4>
        <small className="text-muted">
          {t('dashboard.last_updated', {
            time: lastUpdated ? lastUpdated.toLocaleTimeString(i18n.language) : '-',
            seconds: REFRESH_INTERVAL_MS / 1000,
          })}
        </small>
      </div>

      <CRow className="g-4 mb-4">
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">{t('dashboard.kpi.total_tickets')}</div>
            <div className="fs-2 fw-semibold">{ticketStats.total}</div>
            <div className="text-muted small">{t('dashboard.kpi.in_system')}</div>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">{t('dashboard.kpi.open')}</div>
            <div className="fs-2 fw-semibold">{ticketStats.open}</div>
            <CBadge color="warning">{t('dashboard.badges.to_process')}</CBadge>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">{t('dashboard.kpi.in_progress')}</div>
            <div className="fs-2 fw-semibold">{ticketStats.inProgress}</div>
            <CBadge color="info">{t('dashboard.badges.in_progress')}</CBadge>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">{t('dashboard.kpi.resolved')}</div>
            <div className="fs-2 fw-semibold">{ticketStats.resolved}</div>
            <CBadge color="success">{t('dashboard.badges.resolved')}</CBadge>
          </CCard>
        </CCol>
      </CRow>

      {isStaff && (
        <>
          <h5 className="mb-2">{t('dashboard.live.title')}</h5>

          <CRow className="g-4 mb-4">
            <CCol xs={12} md={6} xl={3}>
              <CCard className="p-3 h-100">
                <div className="text-uppercase text-secondary small mb-2">{t('dashboard.live.online_machines')}</div>
                <div className="d-flex align-items-baseline gap-2">
                  <span className="fs-2 fw-semibold text-success">{realtime?.machines?.online ?? '-'}</span>
                  <span className="text-muted">/ {realtime?.machines?.total ?? '-'}</span>
                </div>
                <div className="text-danger small mt-1">
                  {t('dashboard.live.offline_count', { count: realtime?.machines?.offline ?? 0 })}
                </div>
              </CCard>
            </CCol>

            <CCol xs={12} md={6} xl={3}>
              <CCard className="p-3 h-100" style={{ cursor: 'pointer' }} onClick={() => navigate('/anomalies')}>
                <div className="text-uppercase text-secondary small mb-2">{t('dashboard.live.open_alerts')}</div>
                <div className="fs-2 fw-semibold text-warning">{realtime?.alerts?.total ?? 0}</div>
                <div className="d-flex gap-2 mt-1">
                  {realtime?.alerts?.critical > 0 && (
                    <CBadge color="danger">
                      {t('dashboard.live.critical_count', { count: realtime.alerts.critical })}
                    </CBadge>
                  )}
                  {realtime?.alerts?.high > 0 && (
                    <CBadge color="warning">
                      {t('dashboard.live.high_count', { count: realtime.alerts.high })}
                    </CBadge>
                  )}
                </div>
              </CCard>
            </CCol>

            <CCol xs={12} md={6} xl={3}>
              <CCard className="p-3 h-100">
                <div className="text-uppercase text-secondary small mb-2">{t('dashboard.live.new_24h')}</div>
                <div className="fs-2 fw-semibold text-info">{realtime?.newAssets?.length ?? 0}</div>
                <div className="text-muted small">{t('dashboard.live.auto_detected_assets')}</div>
              </CCard>
            </CCol>

            <CCol xs={12} md={6} xl={3}>
              <CCard className="p-3 h-100">
                <div className="text-uppercase text-secondary small mb-2">{t('dashboard.live.asset_health')}</div>
                <div
                  className="fs-2 fw-semibold"
                  style={{ color: realtime?.health?.missing > 0 ? '#dc3545' : '#198754' }}
                >
                  {realtime?.health?.missing ?? 0}
                </div>
                <div className="text-muted small">{t('dashboard.live.missing_assets')}</div>
              </CCard>
            </CCol>
          </CRow>

          <CRow className="g-4 mb-4">
            <CCol xs={12} md={6}>
              <CCard className="h-100">
                <CCardHeader>{t('dashboard.auto_tickets.title')}</CCardHeader>
                <CCardBody>
                  {!realtime?.autoTickets?.length ? (
                    <p className="text-muted small mb-0">{t('dashboard.auto_tickets.empty')}</p>
                  ) : (
                    realtime.autoTickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="d-flex justify-content-between align-items-center py-2 border-bottom"
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                      >
                        <div>
                          <div className="small fw-semibold">#{ticket.id} - {ticket.title}</div>
                          <small className="text-muted">
                            {t(`dashboard.triggers.${ticket.auto_trigger_type}`, {
                              defaultValue: ticket.auto_trigger_type,
                            })}
                          </small>
                        </div>
                        <CBadge color="secondary">{ticket.status}</CBadge>
                      </div>
                    ))
                  )}
                </CCardBody>
              </CCard>
            </CCol>

            <CCol xs={12} md={6}>
              <CCard className="h-100">
                <CCardHeader>{t('dashboard.department.title')}</CCardHeader>
                <CCardBody style={{ maxHeight: '260px', overflowY: 'auto' }}>
                  {!realtime?.byDepartment?.length ? (
                    <p className="text-muted small mb-0">{t('dashboard.department.empty')}</p>
                  ) : (
                    realtime.byDepartment.map((department) => (
                      <div
                        key={department.department}
                        className="d-flex justify-content-between align-items-center py-2 border-bottom"
                      >
                        <div className="small">{department.department}</div>
                        <div className="d-flex gap-2">
                          <CBadge color="secondary">
                            {t('dashboard.department.total', { count: department.asset_count })}
                          </CBadge>
                          {department.broken > 0 && (
                            <CBadge color="danger">
                              {t('dashboard.department.broken', { count: department.broken })}
                            </CBadge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          <NetworkMap />
        </>
      )}

      <CRow className="g-4 mb-4">
        {isStaff && (
          <CCol xs={12} md={6} xl={4}>
            <CCard className="p-3 h-100">
              <div className="text-uppercase text-secondary small mb-2">{t('dashboard.assets.title')}</div>
              <div className="fs-2 fw-semibold">{assetCounts.total}</div>
              <div className="d-flex gap-3 mt-3">
                <span className="small text-success">
                  {t('dashboard.assets.in_service', { count: assetCounts.inService })}
                </span>
                <span className="small text-danger">
                  {t('dashboard.assets.offline', { count: assetCounts.offline })}
                </span>
              </div>
            </CCard>
          </CCol>
        )}
        <CCol xs={12} xl={role === 'Agent' ? 12 : 8}>
          <CCard className="h-100">
            <CCardHeader>{t('dashboard.chart.title')}</CCardHeader>
            <CCardBody>
              <CChart
                type="line"
                data={{
                  labels: t('dashboard.chart.days', { returnObjects: true }),
                  datasets: [
                    {
                      label: t('dashboard.chart.open_tickets'),
                      backgroundColor: 'rgba(94,78,241,0.15)',
                      borderColor: '#5e4ef1',
                      data: [12, 18, 14, 20, 16, 22, 19],
                      fill: true,
                    },
                    {
                      label: t('dashboard.chart.resolved_tickets'),
                      backgroundColor: 'rgba(52,211,153,0.12)',
                      borderColor: '#34d399',
                      data: [8, 9, 11, 10, 14, 15, 16],
                      fill: true,
                    },
                  ],
                }}
                options={{ maintainAspectRatio: false, plugins: { legend: { display: true } } }}
                style={{ height: '260px' }}
              />
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="g-4">
        <CCol xs={12} xl={7}>
          <CCard className="h-100">
            <CCardHeader>{t('dashboard.notifications.title')}</CCardHeader>
            <CCardBody>
              {notifications.length === 0 ? (
                <p className="text-muted">{t('dashboard.notifications.empty')}</p>
              ) : (
                notifications.slice(0, 4).map((notification) => (
                  <div key={notification.id} className="mb-3 pb-3 border-bottom">
                    <div className="d-flex justify-content-between mb-1">
                      <strong>{notification.title}</strong>
                      <small className="text-muted">{notification.createdAt}</small>
                    </div>
                    <p className="mb-0 text-muted small">{notification.message}</p>
                  </div>
                ))
              )}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xs={12} xl={5}>
          <CCard className="h-100">
            <CCardHeader>
              {t('dashboard.quick_actions')}
              <small className="text-muted ms-2">- {role}</small>
            </CCardHeader>
            <CCardBody>
              <div className="d-grid gap-3">
                {actions.map((action) => (
                  <CButton
                    key={action.path}
                    color={action.color}
                    onClick={() => navigate(action.path)}
                    className="d-flex align-items-center gap-2"
                  >
                    <CIcon icon={action.icon} size="sm" />
                    {action.label}
                  </CButton>
                ))}
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default Dashboard
