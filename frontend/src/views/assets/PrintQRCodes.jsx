// frontend/src/views/assets/PrintQRCodes.jsx
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CButton, CCard, CCardBody, CCardHeader, CCol, CRow,
  CFormSelect, CSpinner, CAlert, CBadge, CFormCheck,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilQrCode, cilPrint, cilFilter, cilReload } from '@coreui/icons'
import { getAssets } from '../../services/assetService'
import { generateQrCode } from '../../services/qrCodeService'

const PrintQRCodes = () => {
  const { t } = useTranslation()
  const [assets,          setAssets]          = useState([])
  const [filteredAssets,  setFilteredAssets]  = useState([])
  const [selectedIds,     setSelectedIds]     = useState(new Set())
  const [loading,         setLoading]         = useState(true)
  const [generating,      setGenerating]      = useState(false)
  const [error,           setError]           = useState('')

  const [filterLocation,   setFilterLocation]   = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [filterType,       setFilterType]       = useState('')

  useEffect(() => { loadAssets() }, [])

  useEffect(() => {
    let filtered = [...assets]
    if (filterLocation)
      filtered = filtered.filter(a => a.location?.toLowerCase().includes(filterLocation.toLowerCase()))
    if (filterDepartment)
      filtered = filtered.filter(a => a.department?.toLowerCase().includes(filterDepartment.toLowerCase()))
    if (filterType)
      filtered = filtered.filter(a => a.type === filterType)
    setFilteredAssets(filtered)
    // Réinitialiser la sélection quand les filtres changent
    setSelectedIds(new Set())
  }, [filterLocation, filterDepartment, filterType, assets])

  const loadAssets = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAssets()
      setAssets(data)
      setFilteredAssets(data)
      setSelectedIds(new Set())
    } catch {
      setError(t('print_qr.load_error'))
    } finally {
      setLoading(false)
    }
  }

  const uniqueValues = (key) =>
    [...new Set(assets.map(a => a[key]).filter(Boolean))].sort()

  const resetFilters = () => {
    setFilterLocation('')
    setFilterDepartment('')
    setFilterType('')
  }

  // ── Gestion sélection ──────────────────────────────────────────
  const isAllSelected = filteredAssets.length > 0 &&
    filteredAssets.every(a => selectedIds.has(a.id))

  const isIndeterminate = filteredAssets.some(a => selectedIds.has(a.id)) && !isAllSelected

  const toggleAll = () => {
    if (isAllSelected) {
      // Désélectionner tous les filtrés
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredAssets.forEach(a => next.delete(a.id))
        return next
      })
    } else {
      // Sélectionner tous les filtrés
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredAssets.forEach(a => next.add(a.id))
        return next
      })
    }
  }

  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedAssets = filteredAssets.filter(a => selectedIds.has(a.id))

  // ── Génération et impression ───────────────────────────────────
  const handleGenerateAndPrint = async () => {
    const toPrint = selectedAssets.length > 0 ? selectedAssets : filteredAssets
    if (toPrint.length === 0) return

    setGenerating(true)
    setError('')

    try {
      const results = await Promise.all(
        toPrint.map(async (asset) => {
          try {
            const data = await generateQrCode(asset.id)
            return { ...asset, qrSvg: data.qrSvg, qrUrl: data.url }
          } catch {
            return null
          }
        })
      )

      const valid = results.filter(Boolean)

      if (valid.length === 0) {
        setError(t('print_qr.no_qr_generated'))
        return
      }

      openPrintWindow(valid)
    } catch {
      setError('Erreur lors de la génération des QR Codes.')
    } finally {
      setGenerating(false)
    }
  }

  const openPrintWindow = (items) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      setError(t('print_qr.browser_blocked'))
      return
    }

    const labels = items.map(asset => `
      <div class="label">
        <div class="qr">${asset.qrSvg}</div>
        <div class="tag">${asset.assetTag}</div>
        <div class="loc">${asset.location || '—'}</div>
        ${asset.department ? `<div class="dept">${asset.department}</div>` : ''}
      </div>
    `).join('')

    printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${t('print_qr.print_title')} — DRESI ITSM</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .actions {
      position: fixed; top: 0; left: 0; right: 0;
      background: #1e293b; color: #fff;
      padding: 12px 20px;
      display: flex; align-items: center; gap: 12px;
      z-index: 100;
    }
    .actions h2 { font-size: 15px; font-weight: 600; flex: 1; }
    .actions button {
      padding: 7px 18px; border: none; border-radius: 6px;
      font-size: 13px; cursor: pointer; font-weight: 500;
    }
    .btn-print  { background: #2563eb; color: #fff; }
    .btn-close  { background: #475569; color: #fff; }
    .btn-print:hover { background: #1d4ed8; }
    .btn-close:hover { background: #334155; }
    .page {
      padding: 20mm 15mm;
      padding-top: 60px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8mm;
    }
    .label {
      border: 1.5px solid #000;
      border-radius: 6px;
      padding: 10px 8px 8px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .qr { width: 120px; height: 120px; margin: 0 auto 6px; }
    .qr svg { width: 100%; height: 100%; }
    .tag  { font-weight: 700; font-size: 13px; margin-bottom: 3px; }
    .loc  { font-size: 11px; color: #555; }
    .dept { font-size: 10px; color: #888; margin-top: 2px; }
    @media print {
      .actions { display: none !important; }
      .page { padding: 10mm; padding-top: 10mm; }
      body { background: #fff; }
    }
  </style>
</head>
<body>
  <div class="actions">
    <h2>${t('print_qr.print_title')} — ${items.length} ${t('print_qr.print_equipments')} — DRESI ITSM</h2>
    <button class="btn-print" onclick="window.print()">${t('print_qr.print_button')}</button>
    <button class="btn-close" onclick="window.close()">${t('print_qr.close_button')}</button>
  </div>
  <div class="page">
    <div class="grid">${labels}</div>
  </div>
</body>
</html>`)
    printWindow.document.close()
  }

  if (loading) {
    return (
      <div className="text-center p-5">
        <CSpinner size="lg" />
        <p className="mt-3 text-muted">{t('print_qr.loading')}</p>
      </div>
    )
  }

  return (
    <CRow>
      <CCol lg={12}>
        <CCard>
          <CCardHeader>
            <strong>{t('print_qr.title')}</strong>
          </CCardHeader>
          <CCardBody>

            {error && (
              <CAlert color="danger" className="mb-3" dismissible onClose={() => setError('')}>
                {error}
              </CAlert>
            )}

            {/* Filtres */}
            <CCard className="mb-4" style={{ background: 'var(--cui-tertiary-bg)' }}>
              <CCardBody>
                 <div className="d-flex align-items-center gap-2 mb-3">
                  <CIcon icon={cilFilter} size="sm" />
                  <strong className="small">{t('print_qr.filters')}</strong>
                </div>
                <CRow className="g-3">
                  <CCol md={4}>
                    <CFormSelect
                      size="sm"
                      value={filterLocation}
                      onChange={e => setFilterLocation(e.target.value)}
                    >
                       <option value="">{t('print_qr.all_locations')}</option>
                      {uniqueValues('location').map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </CFormSelect>
                  </CCol>
                  <CCol md={4}>
                    <CFormSelect
                      size="sm"
                      value={filterDepartment}
                      onChange={e => setFilterDepartment(e.target.value)}
                    >
                       <option value="">{t('print_qr.all_departments')}</option>
                      {uniqueValues('department').map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </CFormSelect>
                  </CCol>
                  <CCol md={4}>
                    <CFormSelect
                      size="sm"
                      value={filterType}
                      onChange={e => setFilterType(e.target.value)}
                    >
                       <option value="">{t('print_qr.all_types')}</option>
                      {uniqueValues('type').map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </CFormSelect>
                  </CCol>
                </CRow>
                <div className="mt-3 d-flex align-items-center gap-2 flex-wrap">
                  <CBadge color="info">
                    {filteredAssets.length} {t('print_qr.selected_count')}
                  </CBadge>
                  {selectedIds.size > 0 && (
                    <CBadge color="primary">
                      {selectedIds.size} {t('print_qr.selected_count')}
                    </CBadge>
                  )}
                  {(filterLocation || filterDepartment || filterType) && (
                      <CButton size="sm" color="secondary" onClick={resetFilters}>
                        {t('print_qr.reset_filters')}
                      </CButton>
                  )}
                  {selectedIds.size > 0 && (
                  <CButton size="sm" color="outline-danger"
                    onClick={() => setSelectedIds(new Set())}>
                    {t('print_qr.deselect_all')}
                  </CButton>
                  )}
                </div>
              </CCardBody>
            </CCard>

            {/* Bouton principal */}
            <div className="d-flex gap-2 mb-4 align-items-center flex-wrap">
              <CButton
                color="primary"
                onClick={handleGenerateAndPrint}
                disabled={generating || filteredAssets.length === 0}
              >
                {generating ? (
                  <><CSpinner size="sm" className="me-2" />{t('print_qr.generating')}</>
                ) : (
                  <>
                    <CIcon icon={cilPrint} className="me-2" />
                    {selectedIds.size > 0
                      ? t('print_qr.print_selected', { count: selectedIds.size })
                      : t('print_qr.print_all', { count: filteredAssets.length })
                    }
                  </>
                )}
              </CButton>
              <CButton color="secondary" onClick={loadAssets} disabled={loading}>
                <CIcon icon={cilReload} className="me-1" />
                {t('print_qr.refresh')}
              </CButton>
              <span className="text-muted small">
                {selectedIds.size === 0
                  ? t('print_qr.select_hint')
                  : t('print_qr.selected_hint', { count: selectedIds.size })
                }
              </span>
            </div>

            {/* Tableau avec cases à cocher */}
            {filteredAssets.length > 0 ? (
              <CCard>
                <CCardHeader>
                  <strong>
                    {selectedIds.size > 0
                      ? `${selectedIds.size} / ${filteredAssets.length} ${t('print_qr.selected_count')}`
                      : `${filteredAssets.length} ${t('print_qr.selected_count')}`
                    }
                  </strong>
                </CCardHeader>
                <CCardBody className="p-0">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>
                            {/* Case tout sélectionner */}
                              <CFormCheck
                                checked={isAllSelected}
                                ref={el => {
                                  if (el) el.indeterminate = isIndeterminate
                                }}
                                onChange={toggleAll}
                                title={t('print_qr.select_all_title')}
                              />
                          </th>
                          <th>{t('print_qr.table_headers.tag')}</th>
                          <th>{t('print_qr.table_headers.type')}</th>
                          <th>{t('print_qr.table_headers.brand_model')}</th>
                          <th>{t('print_qr.table_headers.location')}</th>
                          <th>{t('print_qr.table_headers.department')}</th>
                          <th>{t('print_qr.table_headers.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAssets.map(asset => (
                          <tr
                            key={asset.id}
                            style={{ cursor: 'pointer' }}
                            className={selectedIds.has(asset.id) ? 'table-active' : ''}
                            onClick={() => toggleOne(asset.id)}
                          >
                            <td onClick={e => e.stopPropagation()}>
                              <CFormCheck
                                checked={selectedIds.has(asset.id)}
                                onChange={() => toggleOne(asset.id)}
                              />
                            </td>
                            <td><strong>{asset.assetTag}</strong></td>
                            <td className="text-muted">{asset.type}</td>
                            <td>{asset.brand} {asset.model}</td>
                            <td>{asset.location || '—'}</td>
                            <td>{asset.department || '—'}</td>
                            <td>
                              <CBadge color={
                                asset.status === 'En service'     ? 'success' :
                                asset.status === 'En panne'       ? 'danger'  :
                                asset.status === 'En maintenance' ? 'warning' : 'secondary'
                              }>
                                {asset.status}
                              </CBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CCardBody>
              </CCard>
            ) : (
              <CAlert color="warning">
                {t('print_qr.no_assets')}
              </CAlert>
            )}

          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default PrintQRCodes