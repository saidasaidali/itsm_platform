// frontend/src/views/assets/ScanResult.jsx
import React, { useEffect, useState, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CButton, CCard, CCardBody, CCardHeader, CCol, CRow,
  CSpinner, CAlert, CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilQrCode, cilInfo, cilClock, cilLockUnlocked,
} from '@coreui/icons'
import { scanQrCode } from '../../services/qrCodeService'

const STATUS_COLORS = {
  'En service':     'success',
  'En panne':       'danger',
  'En maintenance': 'warning',
  'Retiré':         'dark',
}

const ScanResult = () => {
  const { token }       = useParams()
  const navigate        = useNavigate()
  const { t } = useTranslation()
  const { currentUser } = useContext(AuthContext)

  const [asset,        setAsset]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    if (!token) {
      setError(t('qr.scan.missing_token'))
      setLoading(false)
      return
    }

    if (!currentUser) {
      navigate('/login', { state: { from: `/assets/scan/${token}` } })
      return
    }

    const allowedRoles = ['Admin', 'Technicien', 'Agent']
    if (!allowedRoles.includes(currentUser.role)) {
      setUnauthorized(true)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    scanQrCode(token)
      .then((res) => {
        if (res.success) {
          setAsset(res.data)
        } else {
          setError(res.message || t('qr.scan.asset_not_found'))
        }
      })
      .catch((err) => {
        const status = err.response?.status
        if (status === 401) {
          navigate('/login', { state: { from: `/assets/scan/${token}` } })
          return
        }
        if (status === 403) {
          setUnauthorized(true)
          return
        }
        setError(t('qr.scan.invalid_qr'))
      })
      .finally(() => setLoading(false))
  }, [token, currentUser, navigate])

  if (loading) {
    return (
      <div className="text-center p-5">
        <CSpinner size="lg" />
        <p className="mt-3 text-muted">{t('qr.scan.scanning')}</p>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <CRow className="justify-content-center mt-5">
        <CCol lg={6}>
          <CAlert color="warning">
            <CIcon icon={cilLockUnlocked} className="me-2" />
            {t('qr.scan.unauthorized')}
          </CAlert>
          <div className="text-center mt-3">
              <CButton color="secondary" onClick={() => navigate('/dashboard')}>
                {t('qr.scan.back_to_dashboard')}
              </CButton>
          </div>
        </CCol>
      </CRow>
    )
  }

  if (error) {
    return (
      <CRow className="justify-content-center mt-5">
        <CCol lg={6}>
          <CAlert color="danger">
            <CIcon icon={cilInfo} className="me-2" />
            {error}
          </CAlert>
          <div className="text-center mt-3">
              <CButton color="secondary" onClick={() => navigate('/assets')}>
                {t('qr.scan.back_to_assets')}
              </CButton>
          </div>
        </CCol>
      </CRow>
    )
  }

  if (!asset) return null

  return (
    <CRow className="justify-content-center">
      <CCol lg={7}>

        {/* En-tête */}
        <div className="text-center mb-4 mt-2">
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'rgba(37,99,235,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <CIcon icon={cilQrCode} size="xl" style={{ color: '#2563eb' }} />
          </div>
          <h5 className="fw-bold mb-1">{t('qr.scan.scanned_asset')}</h5>
          <p className="text-muted small mb-0">
            {t('qr.scan.asset_info')}
          </p>
        </div>

        {/* Fiche équipement */}
        <CCard className="mb-4">
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <div>
              <strong>{asset.asset_tag}</strong>
              <span className="ms-2 text-muted small">{asset.type}</span>
            </div>
            <CBadge color={STATUS_COLORS[asset.status] || 'secondary'}>
              {asset.status}
            </CBadge>
          </CCardHeader>
          <CCardBody>
            <CRow className="g-3">
              <CCol md={6}>
                <div className="small text-muted mb-1">{t('assets.fields.brand_model')}</div>
                <div className="fw-semibold">{asset.brand} {asset.model}</div>
              </CCol>
              <CCol md={6}>
                <div className="small text-muted mb-1">{t('qr.scan.location')}</div>
                <div className="fw-semibold">{asset.location || '—'}</div>
              </CCol>
              <CCol md={6}>
                <div className="small text-muted mb-1">{t('assets.fields.assigned_user')}</div>
                <div className="fw-semibold">{asset.assigned_to_name || '—'}</div>
              </CCol>
              <CCol md={6}>
                <div className="small text-muted mb-1">{t('assets.fields.serial_number')}</div>
                <div className="fw-semibold">{asset.serial_number || '—'}</div>
              </CCol>
              {asset.department && (
                <CCol md={6}>
                <div className="small text-muted mb-1">{t('assets.fields.department')}</div>
                  <div className="fw-semibold">{asset.department}</div>
                </CCol>
              )}
            </CRow>
            <hr className="my-3" />
            <div className="d-flex align-items-center gap-2 text-muted small">
              <CIcon icon={cilClock} size="sm" />
              {t('qr.scan.scan_count', { count: asset.scan_count })}
            </div>
          </CCardBody>
        </CCard>

      </CCol>
    </CRow>
  )
}

export default ScanResult