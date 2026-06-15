// src/views/assets/Assets.jsx
import React, { useEffect, useMemo, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader,
  CCol, CFormSelect, CInputGroup, CInputGroupText,
  CRow, CSpinner, CTable, CTableBody, CTableDataCell,
  CTableHead, CTableHeaderCell, CTableRow,
} from '@coreui/react'
import { getAssets, getWarrantyAlerts } from '../../services/assetService'
import { getReliabilityAlerts } from '../../services/ticketService'
const STATUS_COLORS = {
  'En service':    'success',
  'En panne':      'danger',
  'En maintenance':'warning',
  'Retiré':        'dark',
}

const Assets = () => {
  const navigate = useNavigate()
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role

  const [assets, setAssets]                   = useState([])
  const [warrantyAlerts, setWarrantyAlerts]   = useState([])
  const [loading, setLoading]                 = useState(true)
  const [query, setQuery]                     = useState('')
  const [statusFilter, setStatusFilter]       = useState('Tous')
  const [typeFilter, setTypeFilter]           = useState('Tous')
  const [reliabilityAlerts, setReliabilityAlerts] = useState([])
  useEffect(() => {
    Promise.all([
      getAssets(),
      getWarrantyAlerts(),
      getReliabilityAlerts(),   
    ])
      .then(([a, w, r]) => { setAssets(a); setWarrantyAlerts(w); setReliabilityAlerts(r) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const types = useMemo(() => ['Tous', ...new Set(assets.map((a) => a.type))], [assets])

  const filtered = useMemo(() => assets.filter((a) => {
    const q = query.toLowerCase()
    const matchQuery = [a.assetTag, a.brand, a.model, a.assignedTo, a.location, a.department]
      .join(' ').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'Tous' || a.status === statusFilter
    const matchType   = typeFilter   === 'Tous' || a.type   === typeFilter
    return matchQuery && matchStatus && matchType
  }), [assets, query, statusFilter, typeFilter])

  return (
    <>
      {/* ── Alertes garantie ── */}
      {warrantyAlerts.length > 0 && (
        <CAlert color="warning" className="mb-4">
          ⚠️ <strong>{warrantyAlerts.length} équipement(s)</strong> avec garantie expirant dans
          les 30 prochains jours :{' '}
          {warrantyAlerts.map((a) => (
            <span key={a.id}
              className="badge bg-warning text-dark me-1"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/assets/${a.id}`)}>
              {a.assetTag} ({a.daysRemaining}j)
            </span>
          ))}
        </CAlert>
      )}
      {/* Alerte fiabilité */}
{reliabilityAlerts.length > 0 && (
  <CAlert color="danger" className="mb-3">
    🔧 <strong>{reliabilityAlerts.length} équipement(s)</strong> avec fiabilité critique
    (3+ pannes en 6 mois) :{' '}
    {reliabilityAlerts.map((a) => (
      <span key={a.asset_id}
        className="badge bg-danger me-1"
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(`/assets/${a.asset_id}`)}>
        {a.asset_tag} ({a.pannes_6mois} pannes)
      </span>
    ))}
  </CAlert>
)}
      {/* ── En-tête ── */}
      <CRow className="mb-3 align-items-center">
        <CCol>
          <h3 className="mb-0">Inventaire des équipements</h3>
          <small className="text-muted">{assets.length} équipement(s) au total</small>
        </CCol>
        {role === 'Admin' && (
          <CCol xs="auto">
            <CButton color="primary" onClick={() => navigate('/assets/new')}>
              + Ajouter un équipement
            </CButton>
          </CCol>
        )}
      </CRow>

      {/* ── Filtres ── */}
      <CRow className="mb-3 g-2">
        <CCol md={5}>
          <CInputGroup>
            <CInputGroupText>🔍</CInputGroupText>
            <input className="form-control" placeholder="Tag, marque, modèle, affectation..."
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </CInputGroup>
        </CCol>
        <CCol md={3}>
          <CFormSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="Tous">Tous les statuts</option>
            <option value="En service">En service</option>
            <option value="En panne">En panne</option>
            <option value="En maintenance">En maintenance</option>
            <option value="Retiré">Retiré</option>
          </CFormSelect>
        </CCol>
        <CCol md={3}>
          <CFormSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </CFormSelect>
        </CCol>
        {(query || statusFilter !== 'Tous' || typeFilter !== 'Tous') && (
          <CCol md="auto">
            <CButton color="outline-secondary"
              onClick={() => { setQuery(''); setStatusFilter('Tous'); setTypeFilter('Tous') }}>
              Réinitialiser
            </CButton>
          </CCol>
        )}
      </CRow>

      {/* ── Tableau ── */}
      <CCard>
        <CCardHeader className="d-flex justify-content-between">
          <strong>Liste des équipements</strong>
          <span className="text-muted small">{filtered.length} résultat(s)</span>
        </CCardHeader>
        <CCardBody className="p-0">
          {loading ? (
            <div className="text-center p-4"><CSpinner /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted p-4">
              {assets.length === 0 ? 'Aucun équipement enregistré.' : 'Aucun résultat.'}
            </div>
          ) : (
            <CTable hover responsive className="mb-0">
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>Tag</CTableHeaderCell>
                  <CTableHeaderCell>Type</CTableHeaderCell>
                  <CTableHeaderCell>Marque / Modèle</CTableHeaderCell>
                  <CTableHeaderCell>Statut</CTableHeaderCell>
                  <CTableHeaderCell>Affecté à</CTableHeaderCell>
                  <CTableHeaderCell>Direction</CTableHeaderCell>
                  <CTableHeaderCell>Garantie</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {filtered.map((a) => {
                  const daysLeft = a.warrantyEnd
                    ? Math.ceil((new Date(a.warrantyEnd) - new Date()) / 86400000)
                    : null
                  return (
                    <CTableRow key={a.id} style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/assets/${a.id}`)}>
                      <CTableDataCell>
                        <strong>{a.assetTag}</strong>
                      </CTableDataCell>
                      <CTableDataCell>{a.type}</CTableDataCell>
                      <CTableDataCell>{a.brand} {a.model}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={STATUS_COLORS[a.status] || 'secondary'}>
                          {a.status}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        {a.assignedTo || <em className="text-muted">—</em>}
                      </CTableDataCell>
                      <CTableDataCell>
                        {a.department || <em className="text-muted">—</em>}
                      </CTableDataCell>
                      <CTableDataCell>
                        {daysLeft !== null ? (
                          <span className={
                            daysLeft < 0 ? 'text-danger' :
                            daysLeft <= 30 ? 'text-warning fw-bold' : 'text-muted'
                          }>
                            {daysLeft < 0
                              ? `Expirée (${Math.abs(daysLeft)}j)`
                              : `${daysLeft}j`}
                          </span>
                        ) : '—'}
                      </CTableDataCell>
                      <CTableDataCell onClick={(e) => e.stopPropagation()}>
                        <CButton color="outline-primary" size="sm"
                          onClick={() => navigate(`/assets/${a.id}`)}>
                          Voir
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>
    </>
  )
}

export default Assets