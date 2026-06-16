// frontend/src/views/notifications/Notifications.jsx
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader,
  CCol, CFormCheck, CListGroup, CListGroupItem, CRow, CSpinner,
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
} from '@coreui/react'
import {
  getNotifications, markNotificationRead, markAllRead,
  deleteNotification, getPreferences, updatePreferences,
} from '../../services/notificationService'

const PREF_LABELS = [
  { key: 'email_ticket_created', label: '📧 Création de ticket' },
  { key: 'email_status_change',  label: '📧 Changement de statut' },
  { key: 'email_assigned',       label: '📧 Affectation de ticket' },
  { key: 'email_comment',        label: '📧 Nouveau commentaire' },
  { key: 'email_sla_breach',     label: '📧 Dépassement SLA' },
  { key: 'email_closed',         label: '📧 Clôture de ticket' },
  { key: 'web_notifications',    label: '🔔 Notifications dans l\'interface' },
]

const Notifications = () => {
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [prefModal,  setPrefModal]  = useState(false)
  const [prefs,      setPrefs]      = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [success,    setSuccess]    = useState('')

  // ── Charger les notifications ──────────────────────────────
  const fetchNotifs = useCallback(async () => {
    try {
      const data = await getNotifications()
      setNotifications(data)
    } catch (err) {
      console.error('[Notifications]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifs()
    getPreferences().then(setPrefs).catch(console.error)
  }, [fetchNotifs])

  // ── Actions ───────────────────────────────────────────────
  const handleClick = async (n) => {
    // Marquer comme lu au clic
    if (!n.read) {
      await markNotificationRead(n.id).catch(console.error)
      fetchNotifs()
    }
    // Rediriger vers la cible
    if (n.ticketId)     navigate(`/tickets/${n.ticketId}`)
    else if (n.assetId) navigate(`/assets/${n.assetId}`)
  }

  const handleMarkRead = async (e, id) => {
    e.stopPropagation()
    await markNotificationRead(id).catch(console.error)
    fetchNotifs()
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await deleteNotification(id).catch(console.error)
    fetchNotifs()
  }

  const handleMarkAllRead = async () => {
    await markAllRead().catch(console.error)
    fetchNotifs()
  }

  const handleSavePrefs = async () => {
    setSaving(true)
    try {
      await updatePreferences(prefs)
      setSuccess('Préférences sauvegardées.')
      setTimeout(() => { setSuccess(''); setPrefModal(false) }, 1500)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <>
      {/* ── En-tête ── */}
      <CRow className="mb-3 align-items-center">
        <CCol>
          <h3 className="mb-0">
            Notifications
            {unreadCount > 0 && (
              <CBadge color="danger" className="ms-2">{unreadCount} non lue(s)</CBadge>
            )}
          </h3>
        </CCol>
        <CCol xs="auto" className="d-flex gap-2">
          <CButton color="outline-secondary" size="sm" onClick={() => setPrefModal(true)}>
            ⚙️ Préférences
          </CButton>
          {unreadCount > 0 && (
            <CButton color="outline-primary" size="sm" onClick={handleMarkAllRead}>
              Tout marquer lu
            </CButton>
          )}
        </CCol>
      </CRow>

      {/* ── Liste ── */}
      <CCard>
        <CCardHeader>
          <strong>Mes notifications ({notifications.length})</strong>
        </CCardHeader>
        <CCardBody className="p-0">
          {loading ? (
            <div className="text-center p-4"><CSpinner /></div>
          ) : notifications.length === 0 ? (
            <div className="text-center text-muted p-5">
              🔔 Aucune notification pour le moment.
            </div>
          ) : (
            <CListGroup flush>
              {notifications.map((n) => {
                const isClickable = Boolean(n.ticketId || n.assetId)
                return (
                  <CListGroupItem
                    key={n.id}
                    onClick={() => handleClick(n)}
                    style={{
                      background:  n.read ? 'transparent' : 'rgba(59,130,246,0.04)',
                      borderLeft:  n.read ? '3px solid transparent' : '3px solid #3b82f6',
                      cursor:      isClickable ? 'pointer' : 'default',
                      transition:  'background 0.15s',
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="flex-grow-1">
                        {/* Titre + badges */}
                        <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                          <strong style={{ fontSize: '14px' }}>{n.title}</strong>
                          {!n.read && (
                            <CBadge color="primary" style={{ fontSize: '10px' }}>
                              Nouveau
                            </CBadge>
                          )}
                          {/* Lien vers la cible */}
                          {n.ticketId && (
                            <CBadge color="info" style={{ fontSize: '10px' }}>
                              → Ticket #{n.ticketId}
                            </CBadge>
                          )}
                          {n.assetId && (
                            <CBadge color="warning" style={{ fontSize: '10px' }}>
                              → Équipement #{n.assetId}
                            </CBadge>
                          )}
                        </div>
                        {/* Date */}
                        <div className="text-muted small mb-1">
                          {new Date(n.createdAt).toLocaleString('fr-FR')}
                        </div>
                        {/* Message */}
                        <div style={{ fontSize: '13px' }}>{n.message}</div>
                      </div>

                      {/* Boutons action — stopPropagation pour ne pas déclencher handleClick */}
                      <div className="d-flex gap-1 ms-3 flex-shrink-0">
                        {!n.read && (
                          <CButton
                            color="outline-primary"
                            size="sm"
                            title="Marquer comme lu"
                            onClick={(e) => handleMarkRead(e, n.id)}>
                            ✓
                          </CButton>
                        )}
                        <CButton
                          color="outline-danger"
                          size="sm"
                          title="Supprimer"
                          onClick={(e) => handleDelete(e, n.id)}>
                          ✕
                        </CButton>
                      </div>
                    </div>
                  </CListGroupItem>
                )
              })}
            </CListGroup>
          )}
        </CCardBody>
      </CCard>

      {/* ── Modal préférences ── */}
      <CModal visible={prefModal} onClose={() => setPrefModal(false)}>
        <CModalHeader>
          <CModalTitle>⚙️ Préférences de notification</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {success && <CAlert color="success">{success}</CAlert>}
          {prefs ? (
            <div className="d-flex flex-column gap-3">
              <p className="text-muted small mb-0">
                Choisissez les événements pour lesquels vous souhaitez recevoir des notifications.
              </p>
              {PREF_LABELS.map(({ key, label }) => (
                <CFormCheck
                  key={key}
                  id={key}
                  label={label}
                  checked={prefs[key] !== false}
                  onChange={(e) =>
                    setPrefs((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                />
              ))}
            </div>
          ) : (
            <div className="text-center p-3"><CSpinner /></div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleSavePrefs} disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </CButton>
          <CButton color="secondary" onClick={() => setPrefModal(false)}>
            Annuler
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Notifications