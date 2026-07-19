import React, { useEffect, useMemo, useState, useContext, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../auth/AuthProvider'
import usePageTitle from '../../utils/usePageTitle'
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
import { cilSearch, cilCloudUpload, cilQrCode } from '@coreui/icons'
import { getAssets, getWarrantyAlerts, getAssetServices, getAssetDepartments } from '../../services/assetService'
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

  usePageTitle('Assets', 'Manage your IT assets and inventory')

  const [assets, setAssets] = useState([])
  const [warrantyAlerts, setWarrantyAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [serviceFilter, setServiceFilter] = useState(ALL)
  const [reliabilityAlerts, setReliabilityAlerts] = useState([])
  const [services, setServices] = useState([])
  const [departments, setDepartments] = useState([])
  const [departmentFilter, setDepartmentFilter] = useState(ALL)

  const loadData = useCallback(async (filters) => {
    setLoading(true)
    try {
      const [assetList, warrantyList, reliabilityList, servicesList, departmentsList] = await Promise.all([
        getAssets(filters),
        getWarrantyAlerts(),
        getReliabilityAlerts(),
        getAssetServices(),
        getAssetDepartments(),
      ])
      setAssets(assetList)
      setWarrantyAlerts(warrantyList)
      setReliabilityAlerts(reliabilityList)
      setServices(servicesList)
      setDepartments(departmentsList)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Chargement initial et quand les filtres changent
  useEffect(() => {
    const filters = {}
    if (serviceFilter && serviceFilter !== ALL) filters.service = serviceFilter
    if (departmentFilter && departmentFilter !== ALL) filters.department = departmentFilter
    if (statusFilter && statusFilter !== ALL) filters.status = statusFilter
    if (typeFilter && typeFilter !== ALL) filters.type = typeFilter
    loadData(filters)
  }, [serviceFilter, departmentFilter, statusFilter, typeFilter, loadData])

  const handleDepartmentChange = (event) => {
    setDepartmentFilter(event.target.value)
  }

  const types = useMemo(() => [ALL, ...new Set(assets.map((asset) => asset.type))], [assets])

  const filtered = useMemo(
    () =>
      assets.filter((asset) => {
        const q = query.toLowerCase()
        const matchQuery = [asset.assetTag, asset.brand, asset.model, asset.assignedTo, asset.location, asset.department, asset.service]
          .join(' ')
          .toLowerCase()
          .includes(q)
        return matchQuery
      }),
    [assets, query],
  )

  const translateStatus = (status) => t(`assets.status.${status}`, { defaultValue: status })
  const translateType = (type) => (type === ALL ? t('common.all') : t(`assets.type.${type}`, { defaultValue: type }))

  const handleServiceChange = (event) => {
    setServiceFilter(event.target.value)
  }

  const handleReset = () => {
    setQuery('')
    setStatusFilter(ALL)
    setTypeFilter(ALL)
    setDepartmentFilter(ALL)
    setServiceFilter(ALL)
  }

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
          <>
            <CCol xs="auto">
              <CButton color="primary" onClick={() => navigate('/assets/new')}>
                {t('assets.list.add')}
              </CButton>
            </CCol>
            <CCol xs="auto">
              <CButton color="info" style={{ color: '#fff' }} onClick={() => navigate('/assets/import')}>
                <CIcon icon={cilCloudUpload} className="me-1" />
                {t('assets.import.button')}
              </CButton>
            </CCol>
            <CCol xs="auto">
              <CButton color="secondary" onClick={() => navigate('/assets/print-qr')}>
                <CIcon icon={cilQrCode} className="me-1" />
                {t('common.print_qr_codes')}
              </CButton>
            </CCol>
          </>
        )}
      </CRow>

      <CRow className="mb-3 g-2">
        <CCol md={4}>
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
        <CCol md={2}>
          <CFormSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value={ALL}>{t('assets.filters.all_statuses')}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {translateStatus(status)}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={2}>
          <CFormSelect value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            {types.map((type) => (
              <option key={type} value={type}>
                {translateType(type)}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={2}>
          <CFormSelect value={departmentFilter} onChange={handleDepartmentChange}>
            <option value={ALL}>{t('assets.filters.all_departments')}</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={2}>
          <CFormSelect value={serviceFilter} onChange={handleServiceChange}>
            <option value={ALL}>{t('assets.filters.all_services')}</option>
            {services.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </CFormSelect>
        </CCol>
        {(query || statusFilter !== ALL || typeFilter !== ALL || serviceFilter !== ALL) && (
          <CCol md="auto">
            <CButton color="outline-secondary" onClick={handleReset}>
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
                  <CTableHeaderCell>{t('assets.fields.service')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('assets.fields.warranty')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('common.risk_ml')}</CTableHeaderCell>
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
                      <CTableDataCell>{asset.service || <em className="text-muted">-</em>}</CTableDataCell>
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
                      <CTableDataCell>
                        {asset.risk_score != null ? (
                          <CBadge color={
                            asset.risk_level === 'critique' ? 'danger' :
                            asset.risk_level === 'élevé' ? 'warning' :
                            asset.risk_level === 'modéré' ? 'info' : 'success'
                          }>
                            {Math.round(asset.risk_score)}
                          </CBadge>
                        ) : (
                          <span className="text-muted">—</span>
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