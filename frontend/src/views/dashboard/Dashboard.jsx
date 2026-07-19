import React, { useEffect, useState, useContext, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CCol,
  CRow,
  CButton,
  CSpinner,
  CCard,
  CCardBody,
  CCardHeader,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilPeople,
  cilClipboard,
  cilDevices,
  cilBook,
  cilWarning,
  cilBell,
  cilPlus,
  cilSpeedometer,
  cilDiamond,
  cilBolt,
  cilCheck,
  cilMonitor,
  cilLaptop,
  cilCheckCircle,
} from '@coreui/icons'
import { useTranslation } from 'react-i18next'

import { AuthContext } from '../../auth/AuthProvider'
import usePageTitle from '../../utils/usePageTitle'
import { getTicketStats } from '../../services/ticketService'
import { getAssetCounts } from '../../services/assetService'
import { getNotifications } from '../../services/notificationService'
import { getRealtimeDashboard } from '../../services/dashboardService'
import { DashboardKpiCard, ChartCard, ListItem } from '../../components/dashboard'
import NetworkMap from './NetworkMap'
import CalendarWidget from './CalendarWidget'
import { getStats } from '../../services/calendarService'

const REFRESH_INTERVAL_MS = 20000

const Dashboard = () => {
  const { currentUser } = useContext(AuthContext)
  const { t, i18n } = useTranslation()
  const role = currentUser?.role
  const navigate = useNavigate()
  const isStaff = role === 'Admin' || role === 'Technicien'

  usePageTitle('Dashboard', 'View your IT service management dashboard')

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
  const [calendarStats, setCalendarStats] = useState(null)

  const isFirstLoad = useRef(true)

  const fetchAll = useCallback(async () => {
    try {
      const promises = [getTicketStats(), getNotifications(), getStats()]
      if (isStaff) {
        promises.push(getAssetCounts())
        promises.push(getRealtimeDashboard())
      }

      const results = await Promise.all(promises)

      setTicketStats(results[0])
      setNotifications(results[1])
      setCalendarStats(results[2])
      if (isStaff) {
        setAssetCounts(results[3])
        setRealtime(results[4])
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

  const ml = realtime?.ml
  const riskStats = ml?.riskStats

  if (initialLoading) {
    return (
      <div className="text-center p-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <>
      {/* Header avec titre et dernière mise à jour */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">{t('dashboard.title')}</h4>
        <small className="text-muted">
          {t('dashboard.last_updated', {
            time: lastUpdated ? lastUpdated.toLocaleTimeString(i18n.language) : '-',
            seconds: REFRESH_INTERVAL_MS / 1000,
          })}
        </small>
      </div>

      {/* Section 1: KPIs Tickets - Toujours visibles */}
      <CRow className="g-3 mb-4">
        <CCol xs={12} md={6} xl={3}>
          <DashboardKpiCard
            title={t('dashboard.kpi.total_tickets')}
            value={ticketStats.total}
            subtitle={t('dashboard.kpi.in_system')}
            icon={cilClipboard}
            iconColor="text-primary"
          />
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <DashboardKpiCard
            title={t('dashboard.kpi.open')}
            value={ticketStats.open}
            badgeText={t('dashboard.badges.to_process')}
            badgeColor="warning"
            icon={cilBell}
            iconColor="text-warning"
          />
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <DashboardKpiCard
            title={t('dashboard.kpi.in_progress')}
            value={ticketStats.inProgress}
            badgeText={t('dashboard.badges.in_progress')}
            badgeColor="info"
            icon={cilSpeedometer}
            iconColor="text-info"
          />
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <DashboardKpiCard
            title={t('dashboard.kpi.resolved')}
            value={ticketStats.resolved}
            badgeText={t('dashboard.badges.resolved')}
            badgeColor="success"
            icon={cilCheck}
            iconColor="text-success"
          />
        </CCol>
      </CRow>

      {/* Section 2: Calendrier - Largeur complète */}
      <div className="mb-4">
        <CalendarWidget />
      </div>

      {/* Section 3: Supervision en direct - Admin/Technicien seulement */}
      {isStaff && realtime && (
        <>
          <h5 className="mb-3">{t('dashboard.live.title')}</h5>
          <CRow className="g-3 mb-4">
            <CCol xs={12} md={6} xl={3}>
              <DashboardKpiCard
                title={t('dashboard.live.online_machines')}
                value={
                  <span>
                    <span className="text-success">{realtime?.machines?.online ?? '-'}</span>
                    <span className="text-muted mx-1">/</span>
                    <span>{realtime?.machines?.total ?? '-'}</span>
                  </span>
                }
                subtitle={t('dashboard.live.offline_count', { count: realtime?.machines?.offline ?? 0 })}
                icon={cilMonitor}
                iconColor="text-success"
                valueColor="text-success"
              />
            </CCol>

            <CCol xs={12} md={6} xl={3}>
              <DashboardKpiCard
                title={t('dashboard.live.open_alerts')}
                value={realtime?.alerts?.total ?? 0}
                badgeText={
                  <>
                    {realtime?.alerts?.critical > 0 && <CBadge color="danger" className="me-1">{realtime.alerts.critical} {t('dashboard.live.critical_count', { count: 0 }).split(' ')[0]}</CBadge>}
                    {realtime?.alerts?.high > 0 && <CBadge color="warning">{realtime.alerts.high} {t('dashboard.live.high_count', { count: 0 }).split(' ')[0]}</CBadge>}
                  </>
                }
                icon={cilWarning}
                iconColor="text-warning"
                valueColor="text-warning"
                clickable
                onClick={() => navigate('/anomalies')}
              />
            </CCol>

            <CCol xs={12} md={6} xl={3}>
              <DashboardKpiCard
                title={t('dashboard.live.new_24h')}
                value={realtime?.newAssets?.length ?? 0}
                subtitle={t('dashboard.live.auto_detected_assets')}
                icon={cilLaptop}
                iconColor="text-info"
                valueColor="text-info"
              />
            </CCol>

            <CCol xs={12} md={6} xl={3}>
              <DashboardKpiCard
                title={t('dashboard.live.asset_health')}
                value={realtime?.health?.missing ?? 0}
                subtitle={t('dashboard.live.missing_assets')}
                icon={cilCheckCircle}
                iconColor={realtime?.health?.missing > 0 ? 'text-danger' : 'text-success'}
                valueColor={realtime?.health?.missing > 0 ? 'text-danger' : 'text-success'}
              />
            </CCol>
          </CRow>
        </>
      )}

      {/* Section 4: Graphique d'évolution - Largeur complète */}
      <CRow className="g-3 mb-4">
        <CCol xs={12}>
          <ChartCard
            title={t('dashboard.chart.title')}
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
            height="260px"
          />
        </CCol>
      </CRow>

      {/* Section 5: ML Risk Scores - Admin/Technicien seulement */}
      {isStaff && riskStats && (
        <>
          <h5 className="mb-3">
            <CIcon icon={cilSpeedometer} size="sm" className="me-2" />
            {t('dashboard.ml.title')}
          </h5>
          <CRow className="g-3 mb-4">
            <CCol xs={6} md={3} xl={3}>
              <CCard className="p-3 h-100">
                <div className="text-uppercase text-secondary small mb-2">{t('dashboard.ml.avg_score')}</div>
                <div className={`fs-2 fw-semibold ${riskStats.avg_risk_score >= 50 ? 'text-danger' : 'text-success'}`}>
                  {riskStats.avg_risk_score ?? '—'}
                </div>
                <div className="text-muted small">{t('dashboard.ml.per_assets', { count: riskStats.total_scored })}</div>
              </CCard>
            </CCol>
            <CCol xs={6} md={3} xl={3}>
              <CCard className="p-3 h-100" style={{ cursor: 'pointer' }} onClick={() => navigate('/assets')}>
                <div className="text-uppercase text-secondary small mb-2">{t('dashboard.ml.risk_critical')}</div>
                <div className="fs-2 fw-semibold text-danger">{riskStats.critical_count}</div>
                <div className="text-muted small">{t('dashboard.ml.assets_label')}</div>
              </CCard>
            </CCol>
            <CCol xs={6} md={3} xl={3}>
              <CCard className="p-3 h-100" style={{ cursor: 'pointer' }} onClick={() => navigate('/assets')}>
                <div className="text-uppercase text-secondary small mb-2">{t('dashboard.ml.risk_high')}</div>
                <div className="fs-2 fw-semibold text-warning">{riskStats.high_count}</div>
                <div className="text-muted small">{t('dashboard.ml.assets_label')}</div>
              </CCard>
            </CCol>
            <CCol xs={6} md={3} xl={3}>
              <CCard className="p-3 h-100">
                <div className="text-uppercase text-secondary small mb-2">{t('dashboard.ml.risk_low_moderate')}</div>
                <div className="fs-2 fw-semibold text-success">{riskStats.low_count + riskStats.medium_count}</div>
                <div className="text-muted small">{t('dashboard.ml.assets_label')}</div>
              </CCard>
            </CCol>
          </CRow>
        </>
      )}

      {/* Section 6: Contenu Admin/Technicien */}
      {isStaff && ml && (
        <CRow className="g-3 mb-4">
          {/* Top Risky Assets */}
          {ml.topRiskyAssets?.length > 0 && (
            <CCol xs={12} md={6}>
              <CCard className="h-100">
                <CCardHeader>
                  <CIcon icon={cilDiamond} size="sm" className="me-2" />
                  {t('dashboard.ml.top_risky_title')}
                </CCardHeader>
                <CCardBody className="p-0">
                  {ml.topRiskyAssets.map((asset, idx) => (
                    <ListItem
                      key={asset.id}
                      title={
                        <>
                          <span className="me-2 text-muted">#{idx + 1}</span>
                          <span className="fw-semibold">{asset.asset_tag}</span>
                          <span className="text-muted ms-2 small">{asset.type} — {asset.brand} {asset.model}</span>
                        </>
                      }
                      badgeText={`${asset.risk_score}/100 — ${asset.risk_level}`}
                      badgeColor={
                        asset.risk_level === 'critique' ? 'danger' :
                        asset.risk_level === 'élevé' ? 'warning' :
                        asset.risk_level === 'modéré' ? 'info' : 'success'
                      }
                      clickable
                      onClick={() => navigate(`/assets/${asset.id}`)}
                    />
                  ))}
                </CCardBody>
              </CCard>
            </CCol>
          )}

          {/* Failure Predictions */}
          {ml.failurePredictions?.length > 0 && (
            <CCol xs={12} md={6}>
              <CCard className="h-100">
                <CCardHeader>
                  <CIcon icon={cilBolt} size="sm" className="me-2" />
                  {t('dashboard.ml.failure_predictions_title')}
                </CCardHeader>
                <CCardBody className="p-0">
                  {ml.failurePredictions.map((asset) => (
                    <ListItem
                      key={asset.id}
                      title={
                        <>
                          <span className="fw-semibold">{asset.asset_tag}</span>
                          <span className="text-muted ms-2 small">{asset.type}</span>
                        </>
                      }
                      badgeText={`${asset.risk_score}/100`}
                      badgeColor={asset.risk_level === 'critique' ? 'danger' : 'warning'}
                      clickable
                      onClick={() => navigate(`/assets/${asset.id}`)}
                    />
                  ))}
                </CCardBody>
              </CCard>
            </CCol>
          )}

          {/* Auto Tickets */}
          <CCol xs={12} md={6}>
            <CCard className="h-100">
              <CCardHeader>{t('dashboard.auto_tickets.title')}</CCardHeader>
              <CCardBody>
                {!realtime?.autoTickets?.length ? (
                  <p className="text-muted small mb-0">{t('dashboard.auto_tickets.empty')}</p>
                ) : (
                  realtime.autoTickets.map((ticket) => (
                    <ListItem
                      key={ticket.id}
                      title={<><span className="small fw-semibold">#{ticket.id} - {ticket.title}</span></>}
                      subtitle={
                        <span className="text-muted">
                          {t(`dashboard.triggers.${ticket.auto_trigger_type}`, {
                            defaultValue: ticket.auto_trigger_type,
                          })}
                        </span>
                      }
                      badgeText={ticket.status}
                      badgeColor="secondary"
                      clickable
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                    />
                  ))
                )}
              </CCardBody>
            </CCard>
          </CCol>

          {/* Department */}
          <CCol xs={12} md={6}>
            <CCard className="h-100">
              <CCardHeader>{t('dashboard.department.title')}</CCardHeader>
              <CCardBody style={{ maxHeight: '260px', overflowY: 'auto' }}>
                {!realtime?.byDepartment?.length ? (
                  <p className="text-muted small mb-0">{t('dashboard.department.empty')}</p>
                ) : (
                  realtime.byDepartment.map((department) => (
                    <ListItem
                      key={department.department}
                      title={<span className="small">{department.department}</span>}
                      badgeText={t('dashboard.department.total', { count: department.asset_count })}
                      badgeColor="secondary"
                    />
                  ))
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      )}

      {/* Section 7: Network Map - Admin/Technicien seulement */}
      {isStaff && <div className="mb-4"><NetworkMap /></div>}

      {/* Section 8: Équipements + Notifications + Actions rapides */}
      <CRow className="g-3">
        {/* Équipements - Admin/Technicien */}
        {isStaff && (
          <CCol xs={12} md={6} xl={4}>
            <DashboardKpiCard
              title={t('dashboard.assets.title')}
              value={assetCounts.total}
              subtitle={
                <span>
                  <span className="text-success">{t('dashboard.assets.in_service', { count: assetCounts.inService })}</span>
                  <span className="text-danger ms-2">{t('dashboard.assets.offline', { count: assetCounts.offline })}</span>
                </span>
              }
              icon={cilDevices}
              iconColor="text-primary"
            />
          </CCol>
        )}

        {/* Notifications */}
        <CCol xs={12} xl={isStaff ? 7 : 8}>
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

        {/* Actions rapides */}
        <CCol xs={12} xl={isStaff ? 5 : 8}>
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