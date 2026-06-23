import React, { useEffect, useMemo, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch } from '@coreui/icons'
import { getAssets, getWarrantyAlerts } from '../../services/assetService'
import { getReliabilityAlerts } from '../../services/ticketService'

const STATUS_COLORS = {
  'En service': 'success',
  'En panne': 'danger',
  'En maintenance': 'warning',
  Retiré: 'dark',
}

const STATUSES = ['En service', 'En panne', 'En maintenance', 'Retiré']
const ALL = 'Tous'

const Assets = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role

  const [assets, setAssets] = useState([])
  const [warrantyAlerts, setWarrantyAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [reliabilityAlerts, setReliabilityAlerts] = useState([])

  useEffect(() => {
    Promise.all([getAssets(), getWarrantyAlerts(), getReliabilityAlerts()])
      .then(([assetList, warrantyList, reliabilityList]) => {
        setAssets(assetList)
        setWarrantyAlerts(warrantyList)
        setReliabilityAlerts(reliabilityList)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const types = useMemo(() => [ALL, ...new Set(assets.map((asset) => asset.type))], [assets])

  const filtered = useMemo(
    () =>
      assets.filter((asset) => {
        const q = query.toLowerCase()
        const matchQuery = [asset.assetTag, asset.brand, asset.model, asset.assignedTo, asset.location, asset.department]
          .join(' ')
          .toLowerCase()
          .includes(q)
        const matchStatus = statusFilter === ALL || asset.status === statusFilter
        const matchType = typeFilter === ALL || asset.type === typeFilter
        return matchQuery && matchStatus && matchType
      }),
    [assets, query, statusFilter, typeFilter],
  )

  const translateStatus = (status) => t(`assets.status.${status}`, { defaultValue: status })
  const translateType = (type) => (type === ALL ? t('common.all') : t(`assets.type.${type}`, { defaultValue: type }))

  return (
    <>
      {warrantyAlerts.length > 0 && (
        <CAlert color="warning" className="mb-4">
          <strong>{t('assets.alerts.warranty_count', { count: warrantyAlerts.length })}</strong>{' '}
          {t('assets.alerts.warranty_text')}{' '}
          {warrantyAlerts.map((asset) => (
            <span
              key={asset.id}
              className="badge bg-warning text-dark me-1"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/assets/${asset.id}`)}
            >
              {asset.assetTag} ({t('assets.alerts.days_short', { count: asset.daysRemaining })})
            </span>
          ))}
        </CAlert>
      )}

      {reliabilityAlerts.length > 0 && (
        <CAlert color="danger" className="mb-3">
          <strong>{t('assets.alerts.reliability_count', { count: reliabilityAlerts.length })}</strong>{' '}
          {t('assets.alerts.reliability_text')}{' '}
          {reliabilityAlerts.map((asset) => (
            <span
              key={asset.asset_id}
              className="badge bg-danger me-1"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/assets/${asset.asset_id}`)}
            >
              {asset.asset_tag} ({t('assets.alerts.failures', { count: asset.pannes_6mois })})
            </span>
          ))}
        </CAlert>
      )}

      <CRow className="mb-3 align-items-center">
        <CCol>
          <h3 className="mb-0">{t('assets.list.title')}</h3>
          <small className="text-muted">{t('assets.list.total', { count: assets.length })}</small>
        </CCol>
        {role === 'Admin' && (
          <CCol xs="auto">
            <CButton color="primary" onClick={() => navigate('/assets/new')}>
              {t('assets.list.add')}
            </CButton>
          </CCol>
        )}
      </CRow>

      <CRow className="mb-3 g-2">
        <CCol md={5}>
          <CInputGroup>
            <CInputGroupText>
              <CIcon icon={cilSearch} />
            </CInputGroupText>
            <input
              className="form-control"
              placeholder={t('assets.list.search_placeholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </CInputGroup>
        </CCol>
        <CCol md={3}>
          <CFormSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value={ALL}>{t('assets.filters.all_statuses')}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {translateStatus(status)}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={3}>
          <CFormSelect value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            {types.map((type) => (
              <option key={type} value={type}>
                {translateType(type)}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        {(query || statusFilter !== ALL || typeFilter !== ALL) && (
          <CCol md="auto">
            <CButton
              color="outline-secondary"
              onClick={() => {
                setQuery('')
                setStatusFilter(ALL)
                setTypeFilter(ALL)
              }}
            >
              {t('common.reset')}
            </CButton>
          </CCol>
        )}
      </CRow>

      <CCard>
        <CCardHeader className="d-flex justify-content-between">
          <strong>{t('assets.list.table_title')}</strong>
          <span className="text-muted small">{t('common.results_count', { count: filtered.length })}</span>
        </CCardHeader>
        <CCardBody className="p-0">
          {loading ? (
            <div className="text-center p-4">
              <CSpinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted p-4">
              {assets.length === 0 ? t('assets.list.empty') : t('assets.list.no_match')}
            </div>
          ) : (
            <CTable hover responsive className="mb-0">
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>{t('assets.fields.tag')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('assets.fields.type')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('assets.fields.brand_model')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('assets.fields.status')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('assets.fields.assigned_to')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('assets.fields.department')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('assets.fields.warranty')}</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {filtered.map((asset) => {
                  const daysLeft = asset.warrantyEnd
                    ? Math.ceil((new Date(asset.warrantyEnd) - new Date()) / 86400000)
                    : null
                  return (
                    <CTableRow key={asset.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/assets/${asset.id}`)}>
                      <CTableDataCell>
                        <strong>{asset.assetTag}</strong>
                      </CTableDataCell>
                      <CTableDataCell>{translateType(asset.type)}</CTableDataCell>
                      <CTableDataCell>
                        {asset.brand} {asset.model}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={STATUS_COLORS[asset.status] || 'secondary'}>
                          {translateStatus(asset.status)}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{asset.assignedTo || <em className="text-muted">-</em>}</CTableDataCell>
                      <CTableDataCell>{asset.department || <em className="text-muted">-</em>}</CTableDataCell>
                      <CTableDataCell>
                        {daysLeft !== null ? (
                          <span
                            className={
                              daysLeft < 0
                                ? 'text-danger'
                                : daysLeft <= 30
                                  ? 'text-warning fw-bold'
                                  : 'text-muted'
                            }
                          >
                            {daysLeft < 0
                              ? t('assets.warranty.expired_days', { count: Math.abs(daysLeft) })
                              : t('assets.warranty.days', { count: daysLeft })}
                          </span>
                        ) : (
                          '-'
                        )}
                      </CTableDataCell>
                      <CTableDataCell onClick={(event) => event.stopPropagation()}>
                        <CButton color="outline-primary" size="sm" onClick={() => navigate(`/assets/${asset.id}`)}>
                          {t('common.view')}
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
