// frontend/src/views/knowledge/ImportArticles.jsx
import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CButton, CCard, CCardBody, CCardHeader,
  CCol, CRow, CSpinner, CTable, CTableBody,
  CTableDataCell, CTableHead, CTableHeaderCell, CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilFile, cilCheckAlt, cilX, cilWarning, cilArrowLeft } from '@coreui/icons'
import { importArticlesFromExcel } from '../../services/knowledgeService'

// ── Tokens cohérents avec la palette DRESI ────────────────────────────────────
const T = {
  accent:       '#2563eb',
  accentBg:     'rgba(37,99,235,0.07)',
  accentBorder: 'rgba(37,99,235,0.2)',
  green:        '#16a34a',
  greenBg:      'rgba(22,163,74,0.07)',
  greenBorder:  'rgba(22,163,74,0.2)',
  amber:        '#d97706',
  amberBg:      'rgba(217,119,6,0.07)',
  amberBorder:  'rgba(217,119,6,0.2)',
  red:          '#dc2626',
  redBg:        'rgba(220,38,38,0.07)',
  redBorder:    'rgba(220,38,38,0.2)',
  muted:        'var(--cui-secondary-color)',
  border:       'var(--cui-border-color)',
  subtleBg:     'var(--cui-tertiary-bg)',
  cardBg:       'var(--cui-body-bg)',
}

// ── Badge catégorie ────────────────────────────────────────────────────────────
const CategoryBadge = ({ category }) => {
  const map = {
    'Procédures':             { color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
    'Solutions techniques':   { color: T.green,  bg: T.greenBg },
    'FAQ':                    { color: T.accent,  bg: T.accentBg },
    'Documentation matériel': { color: T.amber,  bg: T.amberBg },
  }
  const s = map[category] || { color: T.muted, bg: T.subtleBg }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      color: s.color, background: s.bg,
      border: `1px solid ${s.color}30`,
      letterSpacing: '0.03em',
    }}>
      {category}
    </span>
  )
}

// ── Carte résumé ──────────────────────────────────────────────────────────────
const SummaryCard = ({ icon, count, label, color, bg, border }) => (
  <CCard style={{
    border: `1px solid ${border}`,
    background: bg,
    borderRadius: 14,
  }} className="h-100">
    <CCardBody className="d-flex flex-column align-items-center justify-content-center py-4">
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
      }}>
        <CIcon icon={icon} style={{ color }} size="lg" />
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
      <div className="text-muted small mt-1" style={{ fontSize: 12 }}>{label}</div>
    </CCardBody>
  </CCard>
)

// ── Composant principal ───────────────────────────────────────────────────────
const ImportArticles = () => {
  const { t } = useTranslation()
  const navigate            = useNavigate()
  const fileInputRef        = useRef()
  const [file, setFile]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (f) => {
    if (!f) return
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'text/plain',
    ]
    const ext = f.name.split('.').pop()?.toLowerCase()
    const allowedExt = ['xlsx', 'xls', 'docx', 'pdf', 'txt']
    if (!allowed.includes(f.type) && !allowedExt.includes(ext || '')) {
      setError(t('knowledge.import_articles.invalid_format'))
      return
    }
    setFile(f)
    setError('')
    setResult(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const data = await importArticlesFromExcel(file)
      // Protection supplémentaire : vérifier que data et data.results existent
      setResult(data?.results || { created: [], skipped: [], errors: [] })
    } catch (err) {
      setError(err.message || t('knowledge.import_articles.import_error'))
    } finally {
      setLoading(false)
    }
  }

  const totalCreated = result?.created?.length || 0
  const totalSkipped = result?.skipped?.length || 0
  const totalErrors  = result?.errors?.length  || 0

  return (
    <CRow className="justify-content-center">
      <CCol lg={9}>

        {/* ── En-tête ── */}
        <div className="d-flex justify-content-between align-items-start mb-4">
          <div>
            <h4 className="mb-1 fw-bold">{t('knowledge.import_articles.title')}</h4>
            <p className="text-muted small mb-0">
              {t('knowledge.import_articles.subtitle')}
            </p>
          </div>
          <CButton
            size="sm"
            onClick={() => navigate('/knowledge')}
            style={{
              background: 'transparent',
              border: `1px solid ${T.border}`,
              color: 'var(--cui-body-color)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
            }}
          >
            <CIcon icon={cilArrowLeft} size="sm" />
            {t('common.cancel')}
          </CButton>
        </div>

        {/* ── Instructions — sans bleu ciel CoreUI ── */}
        <div style={{
          background: T.accentBg,
          border: `1px solid ${T.accentBorder}`,
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
        }}>
          <div className="fw-semibold mb-1" style={{ color: T.accent, fontSize: 14 }}>
            {t('knowledge.import_articles.format_title')}
          </div>
          <div className="small text-muted mb-2">
            {t('knowledge.import_articles.format_desc')}
          </div>
          <div className="d-flex gap-2 flex-wrap mb-2">
            {['titre', 'résumé', 'contenu'].map((col) => (
              <span key={col} style={{
                display: 'inline-block',
                padding: '3px 12px', borderRadius: 20,
                fontSize: 12, fontWeight: 600,
                color: T.accent,
                background: 'rgba(37,99,235,0.12)',
                border: `1px solid ${T.accentBorder}`,
                fontFamily: 'monospace',
              }}>
                {col}
              </span>
            ))}
          </div>
          <div className="small" style={{ color: 'var(--cui-secondary-color)' }}>
            {t('knowledge.import_articles.optional_fields')}{' '}
            <strong style={{ color: 'var(--cui-body-color)' }}>catégorie</strong>,{' '}
            <strong style={{ color: 'var(--cui-body-color)' }}>mots-clés</strong>
          </div>
          <div className="small mt-2" style={{ color: 'var(--cui-secondary-color)' }}>
            {t('knowledge.import_articles.categories_accepted')}{' '}
            <strong style={{ color: 'var(--cui-body-color)' }}>Procédures</strong>,{' '}
            <strong style={{ color: 'var(--cui-body-color)' }}>Solutions techniques</strong>,{' '}
            <strong style={{ color: 'var(--cui-body-color)' }}>FAQ</strong>,{' '}
            <strong style={{ color: 'var(--cui-body-color)' }}>Documentation matériel</strong>
          </div>
        </div>

        {/* ── Zone de dépôt ── */}
        {!result && (
          <CCard style={{ borderRadius: 14, border: `1px solid ${T.border}` }} className="mb-4">
            <CCardBody>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? T.accent : T.border}`,
                  borderRadius: 12,
                  padding: '52px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: dragOver ? T.accentBg : T.subtleBg,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.docx,.pdf,.txt"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFile(e.target.files[0])}
                />
                {/* Icône upload dans un cercle */}
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: dragOver ? T.accentBg : 'var(--cui-tertiary-bg)',
                  border: `2px dashed ${dragOver ? T.accent : T.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                  transition: 'all 0.2s',
                }}>
                  <CIcon
                    icon={cilCloudUpload}
                    size="xl"
                    style={{ color: dragOver ? T.accent : T.muted }}
                  />
                </div>
                <div className="fw-semibold mb-1" style={{ fontSize: 15 }}>
                  {t('knowledge.import_articles.drag_drop')}
                </div>
                <div className="text-muted small">{t('knowledge.import_articles.or_click')}</div>
                <div className="text-muted small mt-1" style={{ fontSize: 11 }}>
                  {t('knowledge.import_articles.file_types')}
                </div>
              </div>

              {/* Fichier sélectionné */}
              {file && (
                <div
                  className="d-flex align-items-center gap-3 mt-3 p-3"
                  style={{
                    background: T.accentBg,
                    border: `1px solid ${T.accentBorder}`,
                    borderRadius: 10,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: T.accentBorder,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <CIcon icon={cilFile} style={{ color: T.accent }} />
                  </div>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="fw-semibold small text-truncate">{file.name}</div>
                    <div className="text-muted small">{(file.size / 1024).toFixed(1)} Ko</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    style={{
                      background: 'transparent', border: 'none',
                      color: T.muted, cursor: 'pointer', padding: 4,
                      borderRadius: 6, display: 'flex', alignItems: 'center',
                    }}
                  >
                    <CIcon icon={cilX} size="sm" />
                  </button>
                </div>
              )}

              {/* Erreur */}
              {error && (
                <div style={{
                  marginTop: 12, padding: '10px 16px',
                  background: T.redBg, border: `1px solid ${T.redBorder}`,
                  borderRadius: 8, color: T.red, fontSize: 14,
                }}>
                  {error}
                </div>
              )}

              {/* Bouton import */}
              {file && (
                <CButton
                  className="mt-3 w-100"
                  onClick={handleImport}
                  disabled={loading}
                  style={{
                    background: T.accent, border: 'none',
                    borderRadius: 10, fontWeight: 600,
                    padding: '10px 0', fontSize: 15,
                  }}
                >
                  {loading
                    ? <><CSpinner size="sm" className="me-2" />{t('knowledge.import_articles.importing')}</>
                    : t('knowledge.import_articles.launch_import')}
                </CButton>
              )}
            </CCardBody>
          </CCard>
        )}

        {/* ── Résultats ── */}
        {result && (
          <>
            {/* Résumé */}
            <CRow className="g-3 mb-4">
              <CCol md={4}>
                <SummaryCard
                  icon={cilCheckAlt} count={totalCreated}
                  label={t('knowledge.import_articles.created_label')}
                  color={T.green} bg={T.greenBg} border={T.greenBorder}
                />
              </CCol>
              <CCol md={4}>
                <SummaryCard
                  icon={cilWarning} count={totalSkipped}
                  label={t('knowledge.import_articles.skipped_label')}
                  color={T.amber} bg={T.amberBg} border={T.amberBorder}
                />
              </CCol>
              <CCol md={4}>
                <SummaryCard
                  icon={cilX} count={totalErrors}
                  label={t('knowledge.import_articles.errors_label')}
                  color={T.red} bg={T.redBg} border={T.redBorder}
                />
              </CCol>
            </CRow>

            {/* Articles créés */}
            {result.created?.length > 0 && (
              <CCard className="mb-3" style={{ borderRadius: 14, border: `1px solid ${T.greenBorder}` }}>
                <CCardHeader style={{ background: T.greenBg, borderBottom: `1px solid ${T.greenBorder}` }}
                  className="d-flex align-items-center gap-2 py-3">
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: T.green + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CIcon icon={cilCheckAlt} style={{ color: T.green }} size="sm" />
                  </div>
                  <strong style={{ color: T.green }}>
                    {t('knowledge.import_articles.created_title', { count: result.created.length })}
                  </strong>
                </CCardHeader>
                <CCardBody className="p-0">
                  <CTable responsive hover className="mb-0" style={{ fontSize: 14 }}>
                    <CTableHead>
                      <CTableRow style={{ background: 'var(--cui-tertiary-bg)' }}>
                        <CTableHeaderCell className="text-muted fw-normal" style={{ fontSize: 12 }}>{t('knowledge.import_articles.table.row')}</CTableHeaderCell>
                        <CTableHeaderCell className="text-muted fw-normal" style={{ fontSize: 12 }}>{t('knowledge.import_articles.table.title')}</CTableHeaderCell>
                        <CTableHeaderCell className="text-muted fw-normal" style={{ fontSize: 12 }}>{t('knowledge.import_articles.table.category')}</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {result.created.map((a, i) => (
                        <CTableRow key={i}>
                          <CTableDataCell className="text-muted">{a.ligne}</CTableDataCell>
                          <CTableDataCell className="fw-semibold">{a.titre}</CTableDataCell>
                          <CTableDataCell><CategoryBadge category={a.categorie} /></CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </CCardBody>
              </CCard>
            )}

            {/* Erreurs */}
            {result.errors?.length > 0 && (
              <CCard className="mb-4" style={{ borderRadius: 14, border: `1px solid ${T.redBorder}` }}>
                <CCardHeader style={{ background: T.redBg, borderBottom: `1px solid ${T.redBorder}` }}
                  className="d-flex align-items-center gap-2 py-3">
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: T.red + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CIcon icon={cilX} style={{ color: T.red }} size="sm" />
                  </div>
                  <strong style={{ color: T.red }}>{t('knowledge.import_articles.errors_label', { count: result.errors.length })}</strong>
                </CCardHeader>
                <CCardBody className="p-0">
                  <CTable responsive hover className="mb-0" style={{ fontSize: 14 }}>
                    <CTableHead>
                      <CTableRow style={{ background: 'var(--cui-tertiary-bg)' }}>
                        <CTableHeaderCell className="text-muted fw-normal" style={{ fontSize: 12 }}>{t('knowledge.import_articles.table.row')}</CTableHeaderCell>
                        <CTableHeaderCell className="text-muted fw-normal" style={{ fontSize: 12 }}>{t('knowledge.import_articles.table.title')}</CTableHeaderCell>
                        <CTableHeaderCell className="text-muted fw-normal" style={{ fontSize: 12 }}>{t('knowledge.import_articles.table.reason')}</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {result.errors.map((a, i) => (
                        <CTableRow key={i}>
                          <CTableDataCell className="text-muted">{a.ligne}</CTableDataCell>
                          <CTableDataCell className="fw-semibold">{a.titre}</CTableDataCell>
                          <CTableDataCell style={{ color: T.red }}>{a.raison}</CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </CCardBody>
              </CCard>
            )}

            {/* Actions finales */}
            <div className="d-flex gap-2">
              <CButton
                onClick={() => navigate('/knowledge')}
                style={{
                  background: T.accent, border: 'none',
                  borderRadius: 9, fontWeight: 600, padding: '9px 20px',
                }}
              >
                {t('knowledge.import_articles.view_articles')}
              </CButton>
              <CButton
                onClick={() => { setResult(null); setFile(null) }}
                style={{
                  background: 'transparent',
                  border: `1px solid ${T.border}`,
                  color: 'var(--cui-body-color)',
                  borderRadius: 9, fontWeight: 500, padding: '9px 20px',
                }}
              >
                {t('knowledge.import_articles.new_import')}
              </CButton>
            </div>
          </>
        )}
      </CCol>
    </CRow>
  )
}

export default ImportArticles
