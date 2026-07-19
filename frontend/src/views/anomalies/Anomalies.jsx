// frontend/src/views/anomalies/Anomalies.jsx
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import usePageTitle from '../../utils/usePageTitle'
import {
  CBadge, CButton, CCard, CCardBody, CCardHeader,
  CCol, CFormSelect, CRow, CSpinner, CAlert,
} from '@coreui/react'
import {
  getAnomalies, resolveAnomaly, getAnomalyStats, getUnknownDevices,
} from '../../services/anomalyService'

const SEVERITY_COLORS = { critical: 'danger', high: 'warning', medium: 'info', low: 'secondary' }

const Anomalies = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  usePageTitle('Anomalies', 'Monitor and resolve system anomalies')

  const [anomalies, setAnomalies]   = useState([])
  const [unknownDevices, setUnknownDevices] = useState([])
  const [stats, setStats]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')

  const fetchData = useCallback(async () => {
    try {
      const [a, s, u] = await Promise.all([
        getAnomalies({ status: statusFilter }),
        getAnomalyStats(),
        getUnknownDevices(),
      ])
      setAnomalies(a)
      setStats(s)
      setUnknownDevices(u)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const handleResolve = async (id, status) => {
    await resolveAnomaly(id, status).catch(console.error)
    fetchData()
  }

  const translateSeverity = (severity) => t(`anomalies.severity.${severity}`, { defaultValue: severity })

  return (
    <>
      <h3 className="mb-4">{t('anomalies.title')}</h3>

      {/* ── Stats ── */}
      {stats && (
        <CRow className="g-3 mb-4">
          <CCol md={3}>
            <CCard className="p-3 text-center">
              <div className="fs-3 fw-bold text-danger">{stats.critical}</div>
              <div className="text-muted small">{t('anomalies.stats_critical')}</div>
            </CCard>
          </CCol>
          <CCol md={3}>
            <CCard className="p-3 text-center">
              <div className="fs-3 fw-bold text-warning">{stats.high}</div>
              <div className="text-muted small">{t('anomalies.stats_high')}</div>
            </CCard>
          </CCol>
          <CCol md={3}>
            <CCard className="p-3 text-center">
              <div className="fs-3 fw-bold text-primary">{stats.open}</div>
              <div className="text-muted small">{t('anomalies.stats_open')}</div>
            </CCard>
          </CCol>
          <CCol md={3}>
            <CCard className="p-3 text-center">
              <div className="fs-3 fw-bold text-info">{stats.last24h}</div>
              <div className="text-muted small">{t('anomalies.stats_last24h')}</div>
            </CCard>
          </CCol>
        </CRow>
      )}

      {/* ── Appareils inconnus ── */}
      {unknownDevices.length > 0 && (
        <CAlert color="warning" className="mb-4">
          <strong>{t('anomalies.unknown_alert', { count: unknownDevices.length })}</strong> {t('anomalies.unknown_alert_desc')}
          <ul className="mb-0 mt-2">
            {unknownDevices.slice(0, 5).map((d) => (
              <li key={d.id} className="small">
                {d.hostname || t('anomalies.unknown_no_name')} — IP : {d.ip_address || '—'} — MAC : {d.mac_address || '—'}
                {' '}({t('anomalies.unknown_seen', { count: d.seen_count })})
              </li>
            ))}
          </ul>
        </CAlert>
      )}

      {/* ── Filtre ── */}
      <CRow className="mb-3">
        <CCol md={3}>
          <CFormSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="open">{t('anomalies.filters.open')}</option>
            <option value="acknowledged">{t('anomalies.filters.acknowledged')}</option>
            <option value="resolved">{t('anomalies.filters.resolved')}</option>
            <option value="ignored">{t('anomalies.filters.ignored')}</option>
            <option value="">{t('anomalies.filters.all')}</option>
          </CFormSelect>
        </CCol>
      </CRow>

      {/* ── Liste anomalies ── */}
      <CCard>
        <CCardHeader><strong>{t('anomalies.list_title', { count: anomalies.length })}</strong></CCardHeader>
        <CCardBody className="p-0">
          {loading ? (
            <div className="text-center p-4"><CSpinner /></div>
          ) : anomalies.length === 0 ? (
            <div className="text-center text-muted p-5">{t('anomalies.empty')}</div>
          ) : (
            anomalies.map((a) => (
              <div key={a.id} className="p-3 border-bottom d-flex justify-content-between align-items-start">
                <div style={{ flex: 1 }}>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <CBadge color={SEVERITY_COLORS[a.severity]}>{translateSeverity(a.severity)}</CBadge>
                    {a.assetTag && (
                      <span className="small text-muted" style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/assets/${a.assetId}`)}>
                        {a.assetTag} ({a.brand} {a.model})
                      </span>
                    )}
                  </div>
                  <div>{a.description}</div>
                  <small className="text-muted">
                    {t('anomalies.detected_on', { date: new Date(a.detectedAt).toLocaleString(t('common.locale', { defaultValue: 'fr-FR' })) })}
                    {a.resolvedBy && ` — ${t('anomalies.resolved_by', { name: a.resolvedBy })}`}
                  </small>
                </div>
                {a.status === 'open' && (
                  <div className="d-flex gap-2 ms-3">
                    <CButton size="sm" color="outline-secondary"
                      onClick={() => handleResolve(a.id, 'acknowledged')}>
                      {t('anomalies.action_seen')}
                    </CButton>
                    <CButton size="sm" color="outline-success"
                      onClick={() => handleResolve(a.id, 'resolved')}>
                      {t('anomalies.action_resolved')}
                    </CButton>
                    <CButton size="sm" color="outline-danger"
                      onClick={() => handleResolve(a.id, 'ignored')}>
                      {t('anomalies.action_ignored')}
                    </CButton>
                  </div>
                )}
              </div>
            ))
          )}
        </CCardBody>
      </CCard>
    </>
  )
}

export default Anomalies