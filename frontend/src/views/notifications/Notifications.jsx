// frontend/src/views/notifications/Notifications.jsx
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader,
  CCol, CFormCheck, CListGroup, CListGroupItem, CRow, CSpinner,
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheck, cilX, cilSettings, cilBell } from '@coreui/icons'
import {
  getNotifications, markNotificationRead, markAllRead,
  deleteNotification, getPreferences, updatePreferences,
} from '../../services/notificationService'
import { translateNotificationMessage } from '../../utils/translate'

const PREF_KEYS = [
  'email_ticket_created',
  'email_status_change',
  'email_assigned',
  'email_comment',
  'email_sla_breach',
  'email_closed',
  'web_notifications'
]

const Notifications = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()

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
    if (!n.read) {
      await markNotificationRead(n.id).catch(console.error)
      fetchNotifs()
    }
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
      setSuccess(t('notifications.prefs_saved'))
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
            {t('notifications.title')}
            {unreadCount > 0 && (
              <CBadge color="danger" className="ms-2">{t('notifications.unread_count', { count: unreadCount })}</CBadge>
            )}
          </h3>
        </CCol>
        <CCol xs="auto" className="d-flex gap-2">
          <CButton color="outline-secondary" size="sm" onClick={() => setPrefModal(true)}
            className="d-flex align-items-center gap-1">
            <CIcon icon={cilSettings} size="sm" />
            {t('notifications.preferences_btn')}
          </CButton>
          {unreadCount > 0 && (
            <CButton color="outline-primary" size="sm" onClick={handleMarkAllRead}>
              {t('notifications.mark_all_read')}
            </CButton>
          )}
        </CCol>
      </CRow>

      {/* ── Liste ── */}
      <CCard>
        <CCardHeader>
          <strong>{t('notifications.my_notifications', { count: notifications.length })}</strong>
        </CCardHeader>
        <CCardBody className="p-0">
          {loading ? (
            <div className="text-center p-4"><CSpinner /></div>
          ) : notifications.length === 0 ? (
            <div className="text-center text-muted p-5">
              {t('notifications.empty')}
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
                              {t('notifications.new_badge')}
                            </CBadge>
                          )}
                          {n.ticketId && (
                            <CBadge color="info" style={{ fontSize: '10px' }}>
                              {t('notifications.ticket_badge', { id: n.ticketId })}
                            </CBadge>
                          )}
                          {n.assetId && (
                            <CBadge color="warning" style={{ fontSize: '10px' }}>
                              {t('notifications.asset_badge', { id: n.assetId })}
                            </CBadge>
                          )}
                        </div>
                        {/* Date */}
                        <div className="text-muted small mb-1">
                          {new Date(n.createdAt).toLocaleString(t('common.locale', { defaultValue: 'fr-FR' }))}
                        </div>
                        {/* Message */}
                        <div style={{ fontSize: '13px' }}>{translateNotificationMessage(n.message)}</div>
                      </div>

                      {/* Boutons action — stopPropagation pour ne pas déclencher handleClick */}
                      <div className="d-flex gap-1 ms-3 flex-shrink-0">
                        {!n.read && (
                          <CButton
                            color="outline-primary"
                            size="sm"
                            title={t('notifications.mark_read_title')}
                            onClick={(e) => handleMarkRead(e, n.id)}>
                            <CIcon icon={cilCheck} size="sm" />
                          </CButton>
                        )}
                        <CButton
                          color="outline-danger"
                          size="sm"
                          title={t('notifications.delete_title')}
                          onClick={(e) => handleDelete(e, n.id)}>
                          <CIcon icon={cilX} size="sm" />
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
          <CModalTitle>{t('notifications.prefs_modal_title')}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {success && <CAlert color="success">{success}</CAlert>}
          {prefs ? (
            <div className="d-flex flex-column gap-3">
              <p className="text-muted small mb-0">
                {t('notifications.prefs_desc')}
              </p>
              {PREF_KEYS.map((key) => (
                <CFormCheck
                  key={key}
                  id={key}
                  label={t(`notifications.labels.${key}`)}
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
            {saving ? t('notifications.prefs_saving') : t('notifications.prefs_save')}
          </CButton>
          <CButton color="secondary" onClick={() => setPrefModal(false)}>
            {t('notifications.prefs_cancel')}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Notifications