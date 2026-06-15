// src/views/assets/AssetDetail.jsx
import React, { useEffect, useState, useRef, useContext, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader,
  CCol, CFormSelect, CModal, CModalBody, CModalFooter,
  CModalHeader, CModalTitle, CRow, CSpinner,
  CFormInput, CToast, CToastBody, CToaster, CToastHeader,
} from '@coreui/react'
import { getAssetById, assignAsset } from '../../services/assetService'
import { getUsers } from '../../services/userService'
import { getTicketsByAsset } from '../../services/ticketService'

const STATUS_COLORS = {
  'En service':    'success',
  'En panne':      'danger',
  'En maintenance':'warning',
  'Retiré':        'dark',
}

const ACTION_ICONS = {
  created:        '🟢',
  assigned:       '👤',
  unassigned:     '🔓',
  status_change:  '🔄',
  modified:       '✏️',
  ticket_created: '🎫',
}

const WARRANTY_DAYS_ALERT = 30

const AssetDetail = () => {
  const { assetId } = useParams()
  const navigate    = useNavigate()
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

  const showToast = (message, color = 'danger') => {
    addToast(
      <CToast color={color} autohide delay={4000}>
        <CToastHeader closeButton>
          <strong className="me-auto">Équipement</strong>
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
      const t = await getTicketsByAsset(assetId)
      setTickets(t)

      const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 3600 * 1000)
      const pannes6mois = t.filter(
        (tk) => tk.category === 'Matériel' && new Date(tk.createdAt) > sixMonthsAgo
      ).length

      setReliability({
        total:      t.length,
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
      setError("Erreur lors du chargement de l'équipement.")
    } finally {
      setLoading(false)
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

  // ── Affectation ───────────────────────────────────────────────
  const handleAssign = async () => {
    try {
      await assignAsset(assetId, {
        userId:     assignForm.userId     || null,
        department: assignForm.department || null,
        office:     assignForm.office     || null,
      })
      showToast('Affectation mise à jour.', 'success')
      setAssignModal(false)
      fetchAsset()
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur')
    }
  }

  const handleDesaffecter = async () => {
    try {
      await assignAsset(assetId, { userId: null })
      showToast('Équipement désaffecté.', 'success')
      fetchAsset()
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur')
    }
  }

  // ── Calcul garantie ───────────────────────────────────────────
  const warrantyDaysLeft = asset?.warrantyEnd
    ? Math.ceil((new Date(asset.warrantyEnd) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  // ── Rendu ─────────────────────────────────────────────────────
  if (loading) return <div className="text-center p-5"><CSpinner /></div>
  if (error)   return <CAlert color="danger">{error}</CAlert>
  if (!asset)  return <CAlert color="warning">Équipement introuvable.</CAlert>

  return (
    <>
      <CToaster ref={toaster} push={toast} placement="top-end" />

      {/* ── Alertes garantie ── */}
      {warrantyDaysLeft !== null && warrantyDaysLeft >= 0 && warrantyDaysLeft <= WARRANTY_DAYS_ALERT && (
        <CAlert color="warning" className="mb-3">
          ⚠️ La garantie expire dans <strong>{warrantyDaysLeft} jour(s)</strong> ({asset.warrantyEnd}).
        </CAlert>
      )}
      {warrantyDaysLeft !== null && warrantyDaysLeft < 0 && (
        <CAlert color="danger" className="mb-3">
          🔴 La garantie a expiré depuis <strong>{Math.abs(warrantyDaysLeft)} jour(s)</strong>.
        </CAlert>
      )}

      {/* ── Alerte fiabilité critique ── */}
      {reliability?.alerte && (
        <CAlert color="danger" className="mb-3">
          🔧 Cet équipement a subi <strong>{reliability.pannes6mois} pannes matérielles</strong> en
          6 mois. Un remplacement ou une maintenance approfondie est recommandée.
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
                  {asset.status}
                </CBadge>
                {role === 'Admin' && (
                  <CButton size="sm" color="primary"
                    onClick={() => navigate(`/assets/${assetId}/edit`)}>
                    Modifier
                  </CButton>
                )}
              </div>
            </CCardHeader>
            <CCardBody>
              <CRow>
                <CCol md={6}>
                  <h6 className="text-muted text-uppercase small mb-3">Identification</h6>
                  <p><strong>Type :</strong> {asset.type}</p>
                  <p><strong>Marque :</strong> {asset.brand}</p>
                  <p><strong>Modèle :</strong> {asset.model}</p>
                  {asset.serialNumber && (
                    <p><strong>N° de série :</strong> {asset.serialNumber}</p>
                  )}
                  <p><strong>Emplacement :</strong> {asset.location || '—'}</p>
                </CCol>
                <CCol md={6}>
                  <h6 className="text-muted text-uppercase small mb-3">Affectation</h6>
                  <p>
                    <strong>Utilisateur :</strong>{' '}
                    {asset.assignedTo || <em className="text-muted">Non affecté</em>}
                  </p>
                  {asset.department && <p><strong>Direction :</strong> {asset.department}</p>}
                  {asset.office     && <p><strong>Bureau :</strong> {asset.office}</p>}
                  {asset.assignedAt && (
                    <p>
                      <strong>Affecté le :</strong>{' '}
                      <span className="text-info">{asset.assignedAt}</span>
                    </p>
                  )}
                  <h6 className="text-muted text-uppercase small mb-3 mt-3">Garantie</h6>
                  <p><strong>Achat :</strong> {asset.purchaseDate || '—'}</p>
                  <p>
                    <strong>Fin garantie :</strong>{' '}
                    {asset.warrantyEnd ? (
                      <span className={warrantyDaysLeft !== null && warrantyDaysLeft <= 30
                        ? 'text-danger fw-bold' : ''}>
                        {asset.warrantyEnd}
                        {warrantyDaysLeft !== null && warrantyDaysLeft >= 0 &&
                          ` (${warrantyDaysLeft}j restants)`}
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
                    👤 {asset.assignedTo ? 'Réaffecter' : 'Affecter'}
                  </CButton>
                  {asset.assignedTo && (
                    <CButton color="outline-danger" size="sm" onClick={handleDesaffecter}>
                      Désaffecter
                    </CButton>
                  )}
                </div>
              )}
            </CCardBody>
          </CCard>

          {/* ── Indicateur de fiabilité ── */}
          {reliability && (
            <CCard className="mb-4">
              <CCardHeader><strong>Indicateur de fiabilité</strong></CCardHeader>
              <CCardBody>
                <CRow className="text-center g-3">
                  <CCol md={4}>
                    <div className="fs-3 fw-bold text-primary">{reliability.total}</div>
                    <div className="text-muted small">Tickets total</div>
                  </CCol>
                  <CCol md={4}>
                    <div className={`fs-3 fw-bold ${reliability.pannes6mois >= 3
                      ? 'text-danger' : reliability.pannes6mois > 0 ? 'text-warning' : 'text-success'}`}>
                      {reliability.pannes6mois}
                    </div>
                    <div className="text-muted small">Pannes matérielles (6 mois)</div>
                  </CCol>
                  <CCol md={4}>
                    <div className={`fs-3 fw-bold ${reliability.alerte ? 'text-danger' : 'text-success'}`}>
                      {reliability.alerte ? '⚠️' : '✓'}
                    </div>
                    <div className="text-muted small">
                      {reliability.alerte ? 'Critique' : 'Fiabilité OK'}
                    </div>
                  </CCol>
                </CRow>
              </CCardBody>
            </CCard>
          )}

          {/* ── Historique des tickets ── */}
          <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <strong>Historique des tickets ({tickets.length})</strong>
            </CCardHeader>
            <CCardBody className="p-0">
              {tickets.length === 0 ? (
                <p className="text-muted p-3 mb-0">Aucun ticket associé à cet équipement.</p>
              ) : (
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Titre</th>
                      <th>Statut</th>
                      <th>Priorité</th>
                      <th>Catégorie</th>
                      <th>Créé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id} style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/tickets/${t.id}`)}>
                        <td className="text-muted">#{t.id}</td>
                        <td>{t.title}</td>
                        <td>
                          <CBadge color={
                            t.status === 'Résolu'   ? 'success' :
                            t.status === 'En cours' ? 'primary' :
                            t.status === 'Clôturé'  ? 'dark'    : 'secondary'
                          }>
                            {t.status}
                          </CBadge>
                        </td>
                        <td>
                          <CBadge color={
                            t.priority === 'Haute'   ? 'danger'  :
                            t.priority === 'Moyenne' ? 'warning' : 'success'
                          }>
                            {t.priority}
                          </CBadge>
                        </td>
                        <td>{t.category || '—'}</td>
                        <td className="text-muted small">{t.createdAt}</td>
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
            <CCardHeader><strong>Cycle de vie</strong></CCardHeader>
            <CCardBody style={{ maxHeight: '700px', overflowY: 'auto' }}>
              {(!asset.history || asset.history.length === 0) && (
                <p className="text-muted">Aucune action enregistrée.</p>
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
                      fontSize: '10px',
                    }}>
                      {ACTION_ICONS[h.actionType] || '•'}
                    </div>
                    <small className="text-muted d-block">
                      {new Date(h.createdAt).toLocaleString('fr-FR')}
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
          <CModalTitle>Affecter — {asset.assetTag}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="mb-3">
            <label className="form-label">Utilisateur</label>
            <CFormSelect
              value={assignForm.userId}
              onChange={(e) => setAssignForm((p) => ({ ...p, userId: e.target.value }))}>
              <option value="">-- Non affecté --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.role_name})
                </option>
              ))}
            </CFormSelect>
          </div>
          <div className="mb-3">
            <label className="form-label">Direction / Service</label>
            <CFormInput
              value={assignForm.department}
              placeholder="DSI, RH, Finance..."
              onChange={(e) => setAssignForm((p) => ({ ...p, department: e.target.value }))}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Bureau</label>
            <CFormInput
              value={assignForm.office}
              placeholder="Bureau 203..."
              onChange={(e) => setAssignForm((p) => ({ ...p, office: e.target.value }))}
            />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleAssign}>
            Confirmer l'affectation
          </CButton>
          <CButton color="secondary" onClick={() => setAssignModal(false)}>
            Annuler
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default AssetDetail