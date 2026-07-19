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
  cilPencil, cilClipboard, cilLink, cilWarning, cilTrash,
  cilQrCode, cilPrint,
} from '@coreui/icons'
import { getAssetById, assignAsset, deleteAsset } from '../../services/assetService'
import { getUsers } from '../../services/userService'
import { getTicketsByAsset } from '../../services/ticketService'
import { getAssetTwin } from '../../services/smartCmdbService'
import { generateQrCode } from '../../services/qrCodeService'
import api from '../../services/api'

const STATUS_COLORS = {
  'En service':     'success',
  'En panne':       'danger',
  'En maintenance': 'warning',
  'Retiré':         'dark',
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

// ── Risk Score Widget ─────────────────────────────────────────────────────────
const RiskScoreWidget = ({ assetId }) => {
  const { t } = useTranslation()
  const [prediction, setPrediction] = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!assetId) return
    api.get(`/api/assets/${assetId}/ml-prediction`)
      .then((res) => setPrediction(res.data?.prediction || res.prediction || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [assetId])

  if (loading) return <div className="text-center p-3"><CSpinner size="sm" /></div>
  if (!prediction) return (
    <div className="text-muted small p-2">
      {t('common.ml_score_unavailable')}
    </div>
  )

  const score = prediction.risk.score
  const level = prediction.risk.level

  const COLOR = {
    critique: '#ef4444',
    élevé:    '#f97316',
    modéré:   '#f59e0b',
    faible:   '#22c55e',
  }
  const color = COLOR[level] || '#6b7280'

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-3">
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: `conic-gradient(${color} ${score * 3.6}deg, var(--cui-border-color) 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--cui-body-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 16, color,
          }}>
            {Math.round(score)}
          </div>
        </div>
        <div>
          <div className="fw-semibold" style={{ color }}>{t('common.risk_level', { level })}</div>
          <div className="text-muted small">{t('common.ml_score', { score })}</div>
        </div>
      </div>

      {prediction.failure.failure_predicted && (
        <div className="p-2 rounded mb-2"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div className="small fw-semibold text-danger">{t('common.failure_probable')}</div>
          <div className="small text-muted">
            {t('common.failure_probability', { probability: prediction.failure.failure_probability })}
          </div>
        </div>
      )}

      {prediction.anomaly.is_anomaly && (
        <div className="p-2 rounded"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="small fw-semibold text-warning">{t('common.anomalous_behavior')}</div>
          <div className="small text-muted">
            {t('common.anomaly_score', { score: prediction.anomaly.anomaly_score })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
const AssetDetail = () => {
  const { assetId } = useParams()
  const navigate    = useNavigate()
  const { t }       = useTranslation()
  const { currentUser } = useContext(AuthContext)
  const role    = currentUser?.role
  const toaster = useRef()

  const [asset,         setAsset]         = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [toast,         addToast]         = useState(0)
  const [users,         setUsers]         = useState([])
  const [tickets,       setTickets]       = useState([])
  const [reliability,   setReliability]   = useState(null)
  const [assignModal,   setAssignModal]   = useState(false)
  const [assignForm,    setAssignForm]    = useState({ userId: '', department: '', office: '' })
  const [twin,          setTwin]          = useState(null)
  const [twinLoading,   setTwinLoading]   = useState(false)
  const [deleteModal,   setDeleteModal]   = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [qrModal,       setQrModal]       = useState(false)
  const [qrData,        setQrData]        = useState(null)
  const [qrLoading,     setQrLoading]     = useState(false)
  const [qrError,       setQrError]       = useState('')

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

  // ── Tickets ───────────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    if (!assetId) return
    try {
      const data = await getTicketsByAsset(assetId)
      setTickets(data)
      const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 3600 * 1000)
      const pannes6mois = data.filter(
        (tk) => tk.category === 'Matériel' && new Date(tk.createdAt) > sixMonthsAgo
      ).length
      setReliability({ total: data.length, pannes6mois, alerte: pannes6mois >= 3 })
    } catch (err) {
      console.error('[fetchTickets]', err)
    }
  }, [assetId])

  // ── Asset ─────────────────────────────────────────────────────
  const fetchAsset = useCallback(async () => {
    if (!assetId) return
    try {
      const a = await getAssetById(assetId)
      setAsset(a)
    } catch {
      setError(t('asset_detail.load_error'))
    } finally {
      setLoading(false)
    }
  }, [assetId, t])

  // ── Digital Twin ──────────────────────────────────────────────
  const fetchTwin = useCallback(async () => {
    if (!assetId) return
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

  useEffect(() => {
    if (asset?.type === 'Ordinateur') fetchTwin()
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
      showToast(e.message || t('asset_detail.error'))
    }
  }

  const handleDesaffecter = async () => {
    try {
      await assignAsset(assetId, { userId: null })
      showToast(t('asset_detail.unassign_success'), 'success')
      fetchAsset()
    } catch (e) {
      showToast(e.message || t('asset_detail.error'))
    }
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      await deleteAsset(assetId)
      showToast(t('asset_detail.delete_success'), 'success')
      navigate('/assets')
    } catch (e) {
      showToast(e.message || t('asset_detail.error'))
      setDeleteLoading(false)
    }
  }

  // ── Génération QR Code ────────────────────────────────────────
  const handleGenerateQr = async () => {
    // Vérification assetId avant tout appel réseau
    if (!assetId) {
      showToast(t('common.missing_asset_id'))
      return
    }

    setQrLoading(true)
    setQrError('')
    setQrData(null)

    try {
      const data = await generateQrCode(assetId)

      // data = { token, url, qrSvg } retourné par le service frontend
      if (!data || !data.qrSvg) {
        setQrError(t('common.no_qr_from_server'))
        setQrModal(true)
        return
      }

      setQrData(data)
      setQrModal(true)
    } catch (e) {
      const status = e.response?.status
      const msg    = e.response?.data?.message || e.message || t('asset_detail.qr_generate_error')

      if (status === 401) {
        showToast(t('common.session_expired'))
        navigate('/login')
        return
      }
      if (status === 403) {
        showToast(t('common.no_rights_qr'))
        return
      }
      if (status === 404) {
        showToast(t('common.asset_not_found'))
        return
      }

      setQrError(msg)
      setQrModal(true)
    } finally {
      setQrLoading(false)
    }
  }

  // ── Calcul garantie ───────────────────────────────────────────
  const warrantyDaysLeft = asset?.warrantyEnd
    ? Math.ceil((new Date(asset.warrantyEnd) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  const translateStatus   = (s) => t(`assets.status.${s}`,   { defaultValue: s })
  const translateRelation = (r) => t(`relation_labels.${r}`,  { defaultValue: r })

  // ── Rendu ─────────────────────────────────────────────────────
  if (loading) return <div className="text-center p-5"><CSpinner /></div>
  if (error)   return <CAlert color="danger">{error}</CAlert>
  if (!asset)  return <CAlert color="warning">{t('asset_detail.not_found')}</CAlert>

  return (
    <>
      <CToaster ref={toaster} push={toast} placement="top-end" />

      {/* Alertes garantie */}
      {warrantyDaysLeft !== null && warrantyDaysLeft >= 0 && warrantyDaysLeft <= WARRANTY_DAYS_ALERT && (
        <CAlert color="warning" className="mb-3">
          {t('asset_detail.warranty_expiring_text')}{' '}
          <strong>{t('asset_detail.warranty_expiring_days', { days: warrantyDaysLeft })}</strong>{' '}
          ({asset.warrantyEnd}).
        </CAlert>
      )}
      {warrantyDaysLeft !== null && warrantyDaysLeft < 0 && (
        <CAlert color="danger" className="mb-3">
          {t('asset_detail.warranty_expired_text')}{' '}
          <strong>{t('asset_detail.warranty_expired_days', { days: Math.abs(warrantyDaysLeft) })}</strong>.
        </CAlert>
      )}

      {/* Alerte fiabilité */}
      {reliability?.alerte && (
        <CAlert color="danger" className="mb-3">
          {t('asset_detail.reliability_alert_text_start')}{' '}
          <strong>{t('asset_detail.reliability_alert_count', { count: reliability.pannes6mois })}</strong>{' '}
          {t('asset_detail.reliability_alert_text_end')}
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
                  <h6 className="text-muted text-uppercase small mb-3">
                    {t('asset_detail.section_identification')}
                  </h6>
                  <p><strong>{t('asset_detail.type')}</strong>{' '}
                    {t(`assets.type.${asset.type}`, { defaultValue: asset.type })}</p>
                  <p><strong>{t('asset_detail.brand')}</strong> {asset.brand}</p>
                  <p><strong>{t('asset_detail.model')}</strong> {asset.model}</p>
                  {asset.serialNumber && (
                    <p><strong>{t('asset_detail.serial_number')}</strong> {asset.serialNumber}</p>
                  )}
                  <p><strong>{t('asset_detail.location')}</strong> {asset.location || '—'}</p>
                </CCol>
                <CCol md={6}>
                  <h6 className="text-muted text-uppercase small mb-3">
                    {t('asset_detail.section_assignment')}
                  </h6>
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
                  <h6 className="text-muted text-uppercase small mb-3 mt-3">
                    {t('asset_detail.section_warranty')}
                  </h6>
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

              {/* Actions Admin */}
              {role === 'Admin' && (
                <div className="mt-3 pt-3 border-top d-flex gap-2 flex-wrap">
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

                  <CButton color="danger" size="sm" onClick={() => setDeleteModal(true)}>
                    <CIcon icon={cilTrash} size="sm" className="me-1" />
                    {t('asset_detail.btn_delete')}
                  </CButton>

                  {/* ✅ Bouton QR Code — assetId garanti ici */}
                  <CButton
                    color="info"
                    size="sm"
                    disabled={qrLoading || !assetId}
                    onClick={handleGenerateQr}
                  >
                    {qrLoading
                      ? <><CSpinner size="sm" className="me-1" />{t('common.loading')}</>
                      : <><CIcon icon={cilQrCode} size="sm" className="me-1" />QR Code</>
                    }
                  </CButton>
                </div>
              )}
            </CCardBody>
          </CCard>

          {/* Digital Twin */}
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
                  <p className="text-muted mb-0">{t('asset_detail.no_live_data')}</p>
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
                          {t('asset_detail.ram')}{' '}
                          {twin.liveState.ram_total_mb ? `(${twin.liveState.ram_total_mb} MB)` : ''}
                        </div>
                      </CCol>
                      <CCol md={3}>
                        <div className="fs-4 fw-bold">{twin.liveState.disk_free_gb ?? '—'} GB</div>
                        <div className="text-muted small">
                          {t('asset_detail.disk_free')}{' '}
                          {twin.liveState.disk_total_gb ? `/ ${twin.liveState.disk_total_gb} GB` : ''}
                        </div>
                      </CCol>
                      <CCol md={3}>
                        <div className="fs-4 fw-bold">
                          {twin.liveState.uptime_hours
                            ? Math.round(twin.liveState.uptime_hours / 24) : '—'}j
                        </div>
                        <div className="text-muted small">{t('asset_detail.uptime')}</div>
                      </CCol>
                    </CRow>
                    {twin.liveState.logged_in_user && (
                      <p className="text-muted small mt-3 mb-0">
                        {t('asset_detail.active_session')}{' '}
                        <strong>{twin.liveState.logged_in_user}</strong>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted mb-0">
                    {t('asset_detail.offline_msg')}{' '}
                    {twin.liveState.last_checked_at
                      ? new Date(twin.liveState.last_checked_at).toLocaleString(
                          t('common.locale', { defaultValue: 'fr-FR' })
                        )
                      : '—'}
                  </p>
                )}
              </CCardBody>
            </CCard>
          )}

          {/* Équipements liés */}
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

          {/* Fiabilité */}
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
                    <div className={`fs-3 fw-bold ${
                      reliability.pannes6mois >= 3 ? 'text-danger'
                      : reliability.pannes6mois > 0 ? 'text-warning' : 'text-success'}`}>
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

          {/* Historique tickets */}
          <CCard className="mb-4">
            <CCardHeader>
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

        {/* ════ Timeline ════ */}
        <CCol md={4}>
          <CCard className="mb-4">
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
                      {new Date(h.createdAt).toLocaleString(
                        t('common.locale', { defaultValue: 'fr-FR' })
                      )}
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

          {/* Risk Score ML */}
          <CCard>
            <CCardHeader><strong>{t('asset_detail.risk_score_title')}</strong></CCardHeader>
            <CCardBody>
              <RiskScoreWidget assetId={assetId} />
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* ── Modal suppression ── */}
      <CModal visible={deleteModal} onClose={() => setDeleteModal(false)}>
        <CModalHeader>
          <CModalTitle>{t('asset_detail.delete_modal_title')}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p>{t('asset_detail.delete_modal_body', { tag: asset.assetTag })}</p>
          <p className="text-danger small">{t('asset_detail.delete_modal_warning')}</p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setDeleteModal(false)} disabled={deleteLoading}>
            {t('common.cancel')}
          </CButton>
          <CButton color="danger" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? t('common.loading') : t('asset_detail.btn_delete')}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ── Modal QR Code ── */}
      <CModal visible={qrModal} onClose={() => { setQrModal(false); setQrError('') }} size="lg">
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilQrCode} className="me-2" />
            QR Code — {asset?.assetTag}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {/* Erreur de génération */}
          {qrError && (
            <CAlert color="danger">
              <strong>Erreur :</strong> {qrError}
            </CAlert>
          )}

          {/* QR Code affiché */}
          {qrData?.qrSvg && (
            <div className="text-center">
              <div
                className="mb-3 p-4 border rounded d-inline-block"
                style={{ background: '#fff', maxWidth: 320 }}
                dangerouslySetInnerHTML={{ __html: qrData.qrSvg }}
              />
              <p className="small text-muted mt-2 mb-0">
                {t('common.url_encoded')}{' '}
                <code className="text-break">{qrData.url}</code>
              </p>
              <p className="small text-muted mt-1">
                {t('common.qr_secure_redirect')}
              </p>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => { setQrModal(false); setQrError('') }}>
            {t('common.close')}
          </CButton>
          {qrData?.url && (
            <CButton color="primary" onClick={() => window.open(qrData.url, '_blank')}>
              <CIcon icon={cilPrint} size="sm" className="me-1" />
              {t('common.test_link')}
            </CButton>
          )}
        </CModalFooter>
      </CModal>

      {/* ── Modal affectation ── */}
      <CModal visible={assignModal} onClose={() => setAssignModal(false)}>
        <CModalHeader>
          <CModalTitle>
            {t('asset_detail.modal_assign_title', { tag: asset.assetTag })}
          </CModalTitle>
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