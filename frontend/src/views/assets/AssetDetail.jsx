// src/views/assets/AssetDetail.jsx
import React, { useEffect, useState, useRef, useContext, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader,
  CCol, CFormSelect, CModal, CModalBody, CModalFooter,
  CModalHeader, CModalTitle, CRow, CSpinner,
  CFormInput, CToast, CToastBody, CToaster, CToastHeader,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilCheckCircle, cilUser, cilLockUnlocked, cilLoopCircular,
  cilPencil, cilClipboard, cilLink, cilWarning,
} from '@coreui/icons'
import { getAssetById, assignAsset } from '../../services/assetService'
import { getUsers } from '../../services/userService'
import { getTicketsByAsset } from '../../services/ticketService'
import { getAssetTwin } from '../../services/smartCmdbService'

const STATUS_COLORS = {
  'En service':    'success',
  'En panne':      'danger',
  'En maintenance':'warning',
  'Retiré':        'dark',
}

const ACTION_ICONS = {
  created:        cilCheckCircle,
  assigned:       cilUser,
  unassigned:     cilLockUnlocked,
  status_change:  cilLoopCircular,
  modified:       cilPencil,
  ticket_created: cilClipboard,
}

const WARRANTY_DAYS_ALERT = 30

const AssetDetail = () => {
  const { assetId } = useParams()
  const navigate    = useNavigate()
  const { t }       = useTranslation()
  const { currentUser } = useContext(AuthContext)
  const role    = currentUser?.role
  const toaster = useRef()

  const [asset,       setAsset]       = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [toast,       addToast]       = useState(0)
  const [users,       setUsers]       = useState([])
  const [tickets,     setTickets]     = useState([])
  const [reliability, setReliability] = useState(null)
  const [assignModal, setAssignModal] = useState(false)
  const [assignForm,  setAssignForm]  = useState({ userId: '', department: '', office: '' })
  const [twin,        setTwin]        = useState(null)
  const [twinLoading, setTwinLoading] = useState(false)

  const showToast = (message, color = 'danger') => {
    addToast(
      <CToast color={color} autohide delay={4000}>
        <CToastHeader closeButton>
          <strong className="me-auto">{t('asset_detail.toast_title')}</strong>
        </CToastHeader>
        <CToastBody className={color === 'danger' ? 'text-white' : ''}>
          {message}
        </CToastBody>
      </CToast>
    )
  }

  // ── Charger les tickets et calculer la fiabilité ──────────────
  const fetchTickets = useCallback(async () => {
    try {
      const data = await getTicketsByAsset(assetId)
      setTickets(data)

      const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 3600 * 1000)
      const pannes6mois = data.filter(
        (tk) => tk.category === 'Matériel' && new Date(tk.createdAt) > sixMonthsAgo
      ).length

      setReliability({
        total:      data.length,
        pannes6mois,
        alerte:     pannes6mois >= 3,
      })
    } catch (err) {
      console.error('[fetchTickets]', err)
    }
  }, [assetId])

  // ── Charger l'équipement ──────────────────────────────────────
  const fetchAsset = useCallback(async () => {
    try {
      const a = await getAssetById(assetId)
      setAsset(a)
    } catch {
      setError(t('asset_detail.load_error'))
    } finally {
      setLoading(false)
    }
  }, [assetId, t])

  // ── Charger le Digital Twin (uniquement pour les ordinateurs) ──
  const fetchTwin = useCallback(async () => {
    setTwinLoading(true)
    try {
      const data = await getAssetTwin(assetId)
      setTwin(data)
    } catch (err) {
      console.error('[fetchTwin]', err)
    } finally {
      setTwinLoading(false)
    }
  }, [assetId])

  // ── Chargement initial ────────────────────────────────────────
  useEffect(() => {
    fetchAsset()
    fetchTickets()
  }, [fetchAsset, fetchTickets])

  useEffect(() => {
    if (role === 'Admin') getUsers().then(setUsers).catch(console.error)
  }, [role])

  // Charger le twin seulement une fois qu'on sait que c'est un ordinateur
  useEffect(() => {
    if (asset?.type === 'Ordinateur') {
      fetchTwin()
    }
  }, [asset?.type, fetchTwin])

  // ── Affectation ───────────────────────────────────────────────
  const handleAssign = async () => {
    try {
      await assignAsset(assetId, {
        userId:     assignForm.userId     || null,
        department: assignForm.department || null,
        office:     assignForm.office     || null,
      })
      showToast(t('asset_detail.assign_updated'), 'success')
      setAssignModal(false)
      fetchAsset()
    } catch (e) {
      showToast(e.response?.data?.message || t('asset_detail.error'))
    }
  }

  const handleDesaffecter = async () => {
    try {
      await assignAsset(assetId, { userId: null })
      showToast(t('asset_detail.unassign_success'), 'success')
      fetchAsset()
    } catch (e) {
      showToast(e.response?.data?.message || t('asset_detail.error'))
    }
  }

  // ── Calcul garantie ───────────────────────────────────────────
  const warrantyDaysLeft = asset?.warrantyEnd
    ? Math.ceil((new Date(asset.warrantyEnd) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  const translateStatus = (status) => t(`assets.status.${status}`, { defaultValue: status })
  const translateRelation = (type) => t(`relation_labels.${type}`, { defaultValue: type })

  // ── Rendu ─────────────────────────────────────────────────────
  if (loading) return <div className="text-center p-5"><CSpinner /></div>
  if (error)   return <CAlert color="danger">{error}</CAlert>
  if (!asset)  return <CAlert color="warning">{t('asset_detail.not_found')}</CAlert>

  return (
    <>
      <CToaster ref={toaster} push={toast} placement="top-end" />

      {/* ── Alertes garantie ── */}
      {warrantyDaysLeft !== null && warrantyDaysLeft >= 0 && warrantyDaysLeft <= WARRANTY_DAYS_ALERT && (
        <CAlert color="warning" className="mb-3">
          {t('asset_detail.warranty_expiring_text')} <strong>{t('asset_detail.warranty_expiring_days', { days: warrantyDaysLeft })}</strong> ({asset.warrantyEnd}).
        </CAlert>
      )}
      {warrantyDaysLeft !== null && warrantyDaysLeft < 0 && (
        <CAlert color="danger" className="mb-3">
          {t('asset_detail.warranty_expired_text')} <strong>{t('asset_detail.warranty_expired_days', { days: Math.abs(warrantyDaysLeft) })}</strong>.
        </CAlert>
      )}

      {/* ── Alerte fiabilité critique ── */}
      {reliability?.alerte && (
        <CAlert color="danger" className="mb-3">
          {t('asset_detail.reliability_alert_text_start')} <strong>{t('asset_detail.reliability_alert_count', { count: reliability.pannes6mois })}</strong> {t('asset_detail.reliability_alert_text_end')}
        </CAlert>
      )}

      <CRow>
        {/* ════ Colonne principale ════ */}
        <CCol md={8}>

          {/* Fiche équipement */}
          <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <div>
                <strong>{asset.assetTag}</strong>
                <span className="ms-2 text-muted">{asset.brand} {asset.model}</span>
              </div>
              <div className="d-flex gap-2 align-items-center">
                <CBadge color={STATUS_COLORS[asset.status] || 'secondary'}>
                  {translateStatus(asset.status)}
                </CBadge>
                {role === 'Admin' && (
                  <CButton size="sm" color="primary"
                    onClick={() => navigate(`/assets/${assetId}/edit`)}>
                    {t('asset_detail.edit_btn')}
                  </CButton>
                )}
              </div>
            </CCardHeader>
            <CCardBody>
              <CRow>
                <CCol md={6}>
                  <h6 className="text-muted text-uppercase small mb-3">{t('asset_detail.section_identification')}</h6>
                  <p><strong>{t('asset_detail.type')}</strong> {t(`assets.type.${asset.type}`, { defaultValue: asset.type })}</p>
                  <p><strong>{t('asset_detail.brand')}</strong> {asset.brand}</p>
                  <p><strong>{t('asset_detail.model')}</strong> {asset.model}</p>
                  {asset.serialNumber && (
                    <p><strong>{t('asset_detail.serial_number')}</strong> {asset.serialNumber}</p>
                  )}
                  <p><strong>{t('asset_detail.location')}</strong> {asset.location || '—'}</p>
                </CCol>
                <CCol md={6}>
                  <h6 className="text-muted text-uppercase small mb-3">{t('asset_detail.section_assignment')}</h6>
                  <p>
                    <strong>{t('asset_detail.user')}</strong>{' '}
                    {asset.assignedTo || <em className="text-muted">{t('asset_detail.unassigned')}</em>}
                  </p>
                  {asset.department && <p><strong>{t('asset_detail.department')}</strong> {asset.department}</p>}
                  {asset.office     && <p><strong>{t('asset_detail.office')}</strong> {asset.office}</p>}
                  {asset.assignedAt && (
                    <p>
                      <strong>{t('asset_detail.assigned_at')}</strong>{' '}
                      <span className="text-info">{asset.assignedAt}</span>
                    </p>
                  )}
                  <h6 className="text-muted text-uppercase small mb-3 mt-3">{t('asset_detail.section_warranty')}</h6>
                  <p><strong>{t('asset_detail.purchase_date')}</strong> {asset.purchaseDate || '—'}</p>
                  <p>
                    <strong>{t('asset_detail.warranty_end')}</strong>{' '}
                    {asset.warrantyEnd ? (
                      <span className={warrantyDaysLeft !== null && warrantyDaysLeft <= 30
                        ? 'text-danger fw-bold' : ''}>
                        {asset.warrantyEnd}
                        {warrantyDaysLeft !== null && warrantyDaysLeft >= 0 &&
                          ` (${t('asset_detail.days_remaining', { days: warrantyDaysLeft })})`}
                      </span>
                    ) : '—'}
                  </p>
                </CCol>
              </CRow>

              {/* Actions admin */}
              {role === 'Admin' && (
                <div className="mt-3 pt-3 border-top d-flex gap-2">
                  <CButton color="warning" size="sm"
                    onClick={() => {
                      setAssignForm({
                        userId:     asset.assignedToId || '',
                        department: asset.department   || '',
                        office:     asset.office       || '',
                      })
                      setAssignModal(true)
                    }}>
                    {asset.assignedTo ? t('asset_detail.btn_reassign') : t('asset_detail.btn_assign')}
                  </CButton>
                  {asset.assignedTo && (
                    <CButton color="outline-danger" size="sm" onClick={handleDesaffecter}>
                      {t('asset_detail.btn_unassign')}
                    </CButton>
                  )}
                </div>
              )}
            </CCardBody>
          </CCard>

          {/* ── Digital Twin : état en direct (ordinateurs uniquement) ── */}
          {asset.type === 'Ordinateur' && (
            <CCard className="mb-4">
              <CCardHeader className="d-flex justify-content-between align-items-center">
                <strong>{t('asset_detail.live_state_title')}</strong>
                {twin?.liveState && (
                  <CBadge color={twin.liveState.is_online ? 'success' : 'secondary'}>
                    {twin.liveState.is_online ? t('asset_detail.online') : t('asset_detail.offline')}
                  </CBadge>
                )}
              </CCardHeader>
              <CCardBody>
                {twinLoading ? (
                  <div className="text-center p-3"><CSpinner size="sm" /></div>
                ) : !twin?.liveState ? (
                  <p className="text-muted mb-0">
                    {t('asset_detail.no_live_data')}
                  </p>
                ) : twin.liveState.is_online ? (
                  <>
                    <CRow className="g-3 text-center">
                      <CCol md={3}>
                        <div className="fs-4 fw-bold"
                          style={{ color: twin.liveState.cpu_usage > 80 ? '#dc3545' : '#28a745' }}>
                          {twin.liveState.cpu_usage ?? '—'}%
                        </div>
                        <div className="text-muted small">{t('asset_detail.cpu')}</div>
                      </CCol>
                      <CCol md={3}>
                        <div className="fs-4 fw-bold"
                          style={{ color: twin.liveState.ram_usage > 85 ? '#dc3545' : '#28a745' }}>
                          {twin.liveState.ram_usage ?? '—'}%
                        </div>
                        <div className="text-muted small">
                          {t('asset_detail.ram')} {twin.liveState.ram_total_mb ? `(${twin.liveState.ram_total_mb} MB)` : ''}
                        </div>
                      </CCol>
                      <CCol md={3}>
                        <div className="fs-4 fw-bold">
                          {twin.liveState.disk_free_gb ?? '—'} GB
                        </div>
                        <div className="text-muted small">
                          {t('asset_detail.disk_free')} {twin.liveState.disk_total_gb ? `/ ${twin.liveState.disk_total_gb} GB` : ''}
                        </div>
                      </CCol>
                      <CCol md={3}>
                        <div className="fs-4 fw-bold">
                          {twin.liveState.uptime_hours ? Math.round(twin.liveState.uptime_hours / 24) : '—'}j
                        </div>
                        <div className="text-muted small">{t('asset_detail.uptime')}</div>
                      </CCol>
                    </CRow>
                    {twin.liveState.logged_in_user && (
                      <p className="text-muted small mt-3 mb-0">
                        {t('asset_detail.active_session')} <strong>{twin.liveState.logged_in_user}</strong>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted mb-0">
                    {t('asset_detail.offline_msg')}{' '}
                    {twin.liveState.last_checked_at
                      ? new Date(twin.liveState.last_checked_at).toLocaleString(t('common.locale', { defaultValue: 'fr-FR' }))
                      : '—'}
                  </p>
                )}
              </CCardBody>
            </CCard>
          )}

          {/* ── Équipements liés (relations détectées) ── */}
          {twin?.relations?.outgoing?.length > 0 && (
            <CCard className="mb-4">
              <CCardHeader><strong>{t('asset_detail.related_assets_title')}</strong></CCardHeader>
              <CCardBody className="p-0">
                {twin.relations.outgoing.map((r) => (
                  <div key={r.id}
                    className="d-flex justify-content-between align-items-center p-3 border-bottom">
                    <div>
                      <span className="badge bg-light text-dark border me-2">
                        {translateRelation(r.relation_type)}
                      </span>
                      {r.asset_tag} — {r.brand} {r.model}
                    </div>
                    <CButton size="sm" color="outline-primary"
                      onClick={() => navigate(`/assets/${r.id}`)}>
                      {t('asset_detail.btn_view')}
                    </CButton>
                  </div>
                ))}
              </CCardBody>
            </CCard>
          )}

          {/* ── Indicateur de fiabilité ── */}
          {reliability && (
            <CCard className="mb-4">
              <CCardHeader><strong>{t('asset_detail.reliability_title')}</strong></CCardHeader>
              <CCardBody>
                <CRow className="text-center g-3">
                  <CCol md={4}>
                    <div className="fs-3 fw-bold text-primary">{reliability.total}</div>
                    <div className="text-muted small">{t('asset_detail.total_tickets')}</div>
                  </CCol>
                  <CCol md={4}>
                    <div className={`fs-3 fw-bold ${reliability.pannes6mois >= 3
                      ? 'text-danger' : reliability.pannes6mois > 0 ? 'text-warning' : 'text-success'}`}>
                      {reliability.pannes6mois}
                    </div>
                    <div className="text-muted small">{t('asset_detail.failures_6m')}</div>
                  </CCol>
                  <CCol md={4}>
                    <div className={`fs-3 fw-bold ${reliability.alerte ? 'text-danger' : 'text-success'}`}>
                      {reliability.alerte ? t('asset_detail.critical') : t('asset_detail.ok')}
                    </div>
                    <div className="text-muted small">
                      {reliability.alerte ? t('asset_detail.critical') : t('asset_detail.reliability_ok')}
                    </div>
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>
          )}

          {/* ── Historique des tickets ── */}
          <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <strong>{t('asset_detail.ticket_history_title', { count: tickets.length })}</strong>
            </CCardHeader>
            <CCardBody className="p-0">
              {tickets.length === 0 ? (
                <p className="text-muted p-3 mb-0">{t('asset_detail.no_tickets')}</p>
              ) : (
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>{t('asset_detail.col_id')}</th>
                      <th>{t('asset_detail.col_title')}</th>
                      <th>{t('asset_detail.col_status')}</th>
                      <th>{t('asset_detail.col_priority')}</th>
                      <th>{t('asset_detail.col_category')}</th>
                      <th>{t('asset_detail.col_created')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((tk) => (
                      <tr key={tk.id} style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/tickets/${tk.id}`)}>
                        <td className="text-muted">#{tk.id}</td>
                        <td>{tk.title}</td>
                        <td>
                          <CBadge color={
                            tk.status === 'Résolu'   ? 'success' :
                            tk.status === 'En cours' ? 'primary' :
                            tk.status === 'Clôturé'  ? 'dark'    : 'secondary'
                          }>
                            {t(`tickets.status.${tk.status}`, { defaultValue: tk.status })}
                          </CBadge>
                        </td>
                        <td>
                          <CBadge color={
                            tk.priority === 'Haute'   ? 'danger'  :
                            tk.priority === 'Moyenne' ? 'warning' : 'success'
                          }>
                            {t(`tickets.priority.${tk.priority}`, { defaultValue: tk.priority })}
                          </CBadge>
                        </td>
                        <td>{t(`tickets.category.${tk.category}`, { defaultValue: tk.category || '—' })}</td>
                        <td className="text-muted small">{tk.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        {/* ════ Timeline historique ════ */}
        <CCol md={4}>
          <CCard>
            <CCardHeader><strong>{t('asset_detail.lifecycle_title')}</strong></CCardHeader>
            <CCardBody style={{ maxHeight: '700px', overflowY: 'auto' }}>
              {(!asset.history || asset.history.length === 0) && (
                <p className="text-muted">{t('asset_detail.no_actions')}</p>
              )}
              <div style={{ position: 'relative', paddingLeft: '28px' }}>
                <div style={{
                  position: 'absolute', left: '10px', top: 0, bottom: 0,
                  width: '2px', background: 'rgba(0,0,0,0.08)',
                }} />
                {asset.history?.map((h, i) => (
                  <div key={h.id || i} style={{ position: 'relative', marginBottom: '20px' }}>
                    <div style={{
                      position: 'absolute', left: '-22px', top: '2px',
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: '#fff', border: '2px solid #dee2e6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CIcon icon={ACTION_ICONS[h.actionType] || cilClipboard} size="sm"
                        style={{ width: '11px', height: '11px' }} />
                    </div>
                    <small className="text-muted d-block">
                      {new Date(h.createdAt).toLocaleString(t('common.locale', { defaultValue: 'fr-FR' }))}
                    </small>
                    {h.actor && <span className="small fw-semibold">{h.actor}</span>}
                    <div className="small mt-1">{h.action}</div>
                    {h.oldValue && h.newValue && (
                      <div className="small text-muted">
                        <span className="text-danger">{h.oldValue}</span>
                        {' → '}
                        <span className="text-success">{h.newValue}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Modal affectation */}
      <CModal visible={assignModal} onClose={() => setAssignModal(false)}>
        <CModalHeader>
          <CModalTitle>{t('asset_detail.modal_assign_title', { tag: asset.assetTag })}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="mb-3">
            <label className="form-label">{t('asset_detail.modal_user_label')}</label>
            <CFormSelect
              value={assignForm.userId}
              onChange={(e) => setAssignForm((p) => ({ ...p, userId: e.target.value }))}>
              <option value="">{t('asset_detail.modal_unassigned')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.role_name})
                </option>
              ))}
            </CFormSelect>
          </div>
          <div className="mb-3">
            <label className="form-label">{t('asset_detail.modal_department_label')}</label>
            <CFormInput
              value={assignForm.department}
              placeholder={t('asset_detail.modal_department_placeholder')}
              onChange={(e) => setAssignForm((p) => ({ ...p, department: e.target.value }))}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">{t('asset_detail.modal_office_label')}</label>
            <CFormInput
              value={assignForm.office}
              placeholder={t('asset_detail.modal_office_placeholder')}
              onChange={(e) => setAssignForm((p) => ({ ...p, office: e.target.value }))}
            />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleAssign}>
            {t('asset_detail.modal_confirm')}
          </CButton>
          <CButton color="secondary" onClick={() => setAssignModal(false)}>
            {t('asset_detail.modal_cancel')}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default AssetDetail