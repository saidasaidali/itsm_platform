// frontend/src/views/reports/Reports.jsx
// Vue principale pour la gestion des rapports IT

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getReports,
  generateReport,
  deleteReport,
  downloadReport,
} from '../../services/reportService'
import './Reports.css'

export default function Reports() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Form state
  const [reportType, setReportType] = useState('monthly')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [filters, setFilters] = useState({})

  const loadReports = async () => {
    try {
      setLoading(true)
      const data = await getReports(page, 20)
      setReports(data.data)
      setTotalPages(data.pagination.totalPages)
    } catch (err) {
      console.error('Error loading reports:', err)
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        alert(t('reports.load_error_unauthorized'))
        window.location.href = '/login'
      } else {
        alert(t('reports.load_error') + ': ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // Load reports on mount
  useEffect(() => {
    loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const handleGenerate = async (e) => {
    e.preventDefault()

    if (!periodStart || !periodEnd) {
      alert(t('reports.select_dates'))
      return
    }

    try {
      setGenerating(true)
      await generateReport(reportType, periodStart, periodEnd, filters)
      alert(t('reports.generating_info'))
      setShowForm(false)
      loadReports()
    } catch (err) {
      alert(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm(t('reports.delete_confirm'))) {
      return
    }

    try {
      await deleteReport(id)
      loadReports()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDownload = (id, filename) => {
    downloadReport(id, filename)
  }

  const getStatusBadge = (status) => {
    const badges = {
      generating: { text: t('reports.status_generating'), class: 'badge-generating' },
      completed: { text: t('reports.status_completed'), class: 'badge-completed' },
      failed: { text: t('reports.status_failed'), class: 'badge-failed' },
    }
    const badge = badges[status] || { text: status, class: 'badge-unknown' }
    return <span className={`badge ${badge.class}`}>{badge.text}</span>
  }

  const getTypeLabel = (type) => {
    const labels = {
      monthly: t('reports.type_monthly'),
      weekly: t('reports.type_weekly'),
      custom: t('reports.type_custom'),
    }
    return labels[type] || type
  }

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h1>{t('reports.title')}</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? t('reports.cancel') : t('reports.generate_btn')}
        </button>
      </div>

      {/* Formulaire de génération */}
      {showForm && (
        <div className="report-form">
          <h2>{t('reports.generate_title')}</h2>
          <form onSubmit={handleGenerate}>
            <div className="form-group">
              <label>{t('reports.report_type')}</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                <option value="monthly">{t('reports.type_monthly')}</option>
                <option value="weekly">{t('reports.type_weekly')}</option>
                <option value="custom">{t('reports.type_custom')}</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('reports.period_start')}</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>{t('reports.period_end')}</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Filtres avancés */}
            <div className="filters-section">
              <h3>{t('reports.filters_optional')}</h3>

              <div className="form-group">
                <label>{t('reports.filter_department')}</label>
                <input
                  type="text"
                  placeholder={t('reports.filter_department_placeholder')}
                  onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>{t('reports.filter_service')}</label>
                <input
                  type="text"
                  placeholder={t('reports.filter_service_placeholder')}
                  onChange={(e) => setFilters({ ...filters, service: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>{t('reports.filter_asset_type')}</label>
                <input
                  type="text"
                  placeholder={t('reports.filter_asset_type_placeholder')}
                  onChange={(e) => setFilters({ ...filters, asset_type: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>{t('reports.filter_status')}</label>
                <input
                  type="text"
                  placeholder={t('reports.filter_status_placeholder')}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>{t('reports.filter_priority')}</label>
                <input
                  type="text"
                  placeholder={t('reports.filter_priority_placeholder')}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>{t('reports.filter_category')}</label>
                <input
                  type="text"
                  placeholder={t('reports.filter_category_placeholder')}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={generating}>
                {generating ? t('reports.generating') : t('reports.generate')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                {t('reports.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des rapports */}
      <div className="reports-list">
        {loading ? (
          <div className="loading">{t('common.loading')}</div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <p>{t('reports.no_reports')}</p>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              {t('reports.generate_first')}
            </button>
          </div>
        ) : (
          <>
            <div className="reports-grid">
              {reports.map((report) => (
                <div key={report.id} className="report-card">
                  <div className="report-header">
                    <h3>{getTypeLabel(report.report_type)}</h3>
                    {getStatusBadge(report.status)}
                  </div>

                  <div className="report-body">
                    <p>
                      <strong>{t('reports.col_period')}:</strong> {report.period_start}{' '}
                      {t('reports.period_to')} {report.period_end}
                    </p>
                    <p>
                      <strong>{t('reports.col_generated_by')}:</strong>{' '}
                      {report.generated_by_name || 'N/A'}
                    </p>
                    <p>
                      <strong>{t('reports.col_date')}:</strong>{' '}
                      {new Date(report.generated_at).toLocaleString(
                        t('common.locale', { defaultValue: 'fr-FR' }),
                      )}
                    </p>

                    {report.status === 'failed' && report.error_message && (
                      <div className="error-message">
                        <strong>{t('reports.error_label')}:</strong> {report.error_message}
                      </div>
                    )}
                  </div>

                  <div className="report-actions">
                    {report.status === 'completed' && (
                      <>
                        <button
                          className="btn-download"
                          onClick={() =>
                            handleDownload(
                              report.id,
                              `rapport_${report.report_type}_${report.period_start}_${report.period_end}.pdf`,
                            )
                          }
                        >
                          {t('reports.download_pdf')}
                        </button>
                        <button
                          className="btn-view"
                          onClick={() => {
                            const token = localStorage.getItem('itsm-auth-token')
                            const url = token
                              ? `/reports/view/${report.id}?token=${encodeURIComponent(token)}`
                              : `/reports/view/${report.id}`
                            navigate(url)
                          }}
                        >
                          {t('reports.view_online')}
                        </button>
                      </>
                    )}
                    <button className="btn-delete" onClick={() => handleDelete(report.id)}>
                      {t('reports.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button onClick={() => setPage(page - 1)} disabled={page === 1}>
                  {t('reports.pagination_prev')}
                </button>
                <span>{t('reports.pagination_page', { page, total: totalPages })}</span>
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages}>
                  {t('reports.pagination_next')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
