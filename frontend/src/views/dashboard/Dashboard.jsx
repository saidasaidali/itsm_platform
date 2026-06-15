import React, { useEffect, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CCard, CCardBody, CCardHeader, CCol, CRow, CButton, CBadge,
} from '@coreui/react'
import { CChart } from '@coreui/react-chartjs'
import { AuthContext } from '../../auth/AuthProvider'
import { getTicketStats } from '../../services/ticketService'
import { getAssetCounts } from '../../services/assetService'
import { getNotifications } from '../../services/notificationService'

const Dashboard = () => {
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role
  const navigate = useNavigate()

  const [ticketStats, setTicketStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 })
  const [assetCounts, setAssetCounts] = useState({ total: 0, inService: 0, offline: 0 })
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    getTicketStats().then(setTicketStats).catch(console.error)
    getAssetCounts().then(setAssetCounts).catch(console.error)
    getNotifications().then(setNotifications).catch(console.error)
  }, [])

  // Actions selon le rôle
  const quickActions = {
    Admin: [
      { label: '👥 Gérer les utilisateurs',   color: 'primary',   path: '/users' },
      { label: '🎫 Voir tous les tickets',     color: 'secondary', path: '/tickets' },
      { label: '🖥️ Gérer les équipements',    color: 'info',      path: '/assets' },
      { label: '📚 Gérer la base de connaissance', color: 'success', path: '/knowledge' },
    ],
    Technicien: [
      { label: '🎫 Mes tickets assignés',      color: 'primary',   path: '/tickets' },
      { label: '📚 Base de connaissance',      color: 'info',      path: '/knowledge' },
      { label: '🔔 Mes notifications',         color: 'secondary', path: '/notifications' },
    ],
    Agent: [
      { label: '➕ Créer un ticket',           color: 'primary',   path: '/tickets/new' },
      { label: '🎫 Mes tickets',               color: 'secondary', path: '/tickets' },
      { label: '📚 Base de connaissance',      color: 'info',      path: '/knowledge' },
      { label: '🔔 Mes notifications',         color: 'light',     path: '/notifications' },
    ],
  }

  const actions = quickActions[role] || []

  return (
    <>
      {/* ── KPI ── */}
      <CRow className="g-4 mb-4">
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">Tickets totaux</div>
            <div className="fs-2 fw-semibold">{ticketStats.total}</div>
            <div className="text-muted small">Dans le système</div>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">Ouverts</div>
            <div className="fs-2 fw-semibold">{ticketStats.open}</div>
            <CBadge color="warning">À traiter</CBadge>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">En cours</div>
            <div className="fs-2 fw-semibold">{ticketStats.inProgress}</div>
            <CBadge color="info">En cours</CBadge>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">Résolus</div>
            <div className="fs-2 fw-semibold">{ticketStats.resolved}</div>
            <CBadge color="success">Résolu</CBadge>
          </CCard>
        </CCol>
      </CRow>

      {/* ── Graphique + Assets ── */}
      <CRow className="g-4 mb-4">
        {(role === 'Admin' || role === 'Technicien') && (
          <CCol xs={12} md={6} xl={4}>
            <CCard className="p-3 h-100">
              <div className="text-uppercase text-secondary small mb-2">Équipements</div>
              <div className="fs-2 fw-semibold">{assetCounts.total}</div>
              <div className="d-flex gap-3 mt-3">
                <span className="small text-success">✓ En service : {assetCounts.inService}</span>
                <span className="small text-danger">✗ Hors service : {assetCounts.offline}</span>
              </div>
            </CCard>
          </CCol>
        )}
        <CCol xs={12} xl={role === 'Agent' ? 12 : 8}>
          <CCard className="h-100">
            <CCardHeader>Évolution des tickets</CCardHeader>
            <CCardBody>
              <CChart
                type="line"
                data={{
                  labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
                  datasets: [
                    {
                      label: 'Tickets ouverts',
                      backgroundColor: 'rgba(94,78,241,0.15)',
                      borderColor: '#5e4ef1',
                      data: [12, 18, 14, 20, 16, 22, 19],
                      fill: true,
                    },
                    {
                      label: 'Tickets résolus',
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

      {/* ── Notifications + Actions rapides ── */}
      <CRow className="g-4">
        <CCol xs={12} xl={7}>
          <CCard className="h-100">
            <CCardHeader>Notifications récentes</CCardHeader>
            <CCardBody>
              {notifications.length === 0 ? (
                <p className="text-muted">Aucune notification récente.</p>
              ) : (
                notifications.slice(0, 4).map((n) => (
                  <div key={n.id} className="mb-3 pb-3 border-bottom">
                    <div className="d-flex justify-content-between mb-1">
                      <strong>{n.title}</strong>
                      <small className="text-muted">{n.createdAt}</small>
                    </div>
                    <p className="mb-0 text-muted small">{n.message}</p>
                  </div>
                ))
              )}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xs={12} xl={5}>
          <CCard className="h-100">
            <CCardHeader>
              Actions rapides
              <small className="text-muted ms-2">— {role}</small>
            </CCardHeader>
            <CCardBody>
              <div className="d-grid gap-3">
                {actions.map((action) => (
                  <CButton
                    key={action.path}
                    color={action.color}
                    onClick={() => navigate(action.path)}
                  >
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