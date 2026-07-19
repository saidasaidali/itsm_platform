// frontend/src/views/reports/ReportViewer.jsx
// Vue pour visualiser un rapport en ligne avec graphiques interactifs

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Pie, Doughnut, Bar, Line } from 'react-chartjs-2'
import './ReportViewer.css'

const API_BASE =
  (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '') + '/api'

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

export default function ReportViewer() {
  const { id } = useParams()
  
  console.log('🟢 ReportViewer MOUNTED')
  console.log('ID du rapport:', id)
  const { t } = useTranslation()
  const [report, setReport] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Récupérer le token depuis l'URL ou localStorage
  const urlParams = new URLSearchParams(window.location.search)
  const tokenFromUrl = urlParams.get('token')
  const tokenFromStorage = localStorage.getItem('itsm-auth-token')
  const authToken = tokenFromUrl || tokenFromStorage

  const loadReport = async () => {
    try {
      setLoading(true)

      if (!authToken) {
        throw new Error(t('reports.viewer.no_token'))
      }

      const headers = {
        Authorization: `Bearer ${authToken}`,
      }

      const reportResponse = await fetch(`${API_BASE}/reports/${id}`, { headers })

      if (!reportResponse.ok) {
        if (reportResponse.status === 401) {
          throw new Error(t('reports.viewer.session_expired'))
        }
        throw new Error(t('reports.viewer.load_error'))
      }

      const reportData = await reportResponse.json()
      setReport(reportData.data)

      if (reportData.data.status === 'completed') {
        const params = new URLSearchParams({
          period_start: reportData.data.period_start,
          period_end: reportData.data.period_end,
        })

        const statsUrl = `${API_BASE}/reports/stats/all?${params.toString()}`

        try {
          const statsResponse = await fetch(statsUrl, { headers })

          if (statsResponse.ok) {
            const statsData = await statsResponse.json()
            setStats(statsData.data)
          } else {
            console.error('Error loading stats:', statsResponse.status)
          }
        } catch (statsErr) {
          console.error('Exception loading stats:', statsErr)
        }
      }
    } catch (err) {
      console.error('Global error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const getTypeLabel = (type) => {
    const labels = {
      monthly: t('reports.type_monthly'),
      weekly: t('reports.type_weekly'),
      custom: t('reports.type_custom'),
    }
    return labels[type] || type
  }

  if (loading) {
    return <div className="loading">{t('reports.viewer.loading')}</div>
  }

  if (error) {
    return (
      <div className="error">
        {t('reports.viewer.error_prefix')}: {error}
      </div>
    )
  }

  if (!report) {
    return <div className="error">{t('reports.viewer.not_found')}</div>
  }

  return (
    <div className="report-viewer">
      <div className="report-viewer-header">
        <h1>
          {t('reports.viewer.title')} {getTypeLabel(report.report_type)}
        </h1>
        <div className="report-meta">
          <span>
            {t('reports.col_period')}: {report.period_start} {t('reports.period_to')}{' '}
            {report.period_end}
          </span>
          <span>
            {t('reports.viewer.generated_on')}:{' '}
            {new Date(report.generated_at).toLocaleString(
              t('common.locale', { defaultValue: 'fr-FR' }),
            )}
          </span>
        </div>
      </div>

      {report.status === 'generating' && (
        <div className="alert alert-info">{t('reports.viewer.generating_wait')}</div>
      )}

      {report.status === 'failed' && (
        <div className="alert alert-error">
          {t('reports.viewer.generation_failed')}: {report.error_message}
        </div>
      )}

      {report.status === 'completed' && (
        <div className="report-content">
          {!stats ? (
            <div className="alert alert-warning">
              {t('reports.viewer.stats_loading')}
              <br />
              <small>{t('reports.viewer.check_console')}</small>
            </div>
          ) : (
            <>
              {/* Résumé Exécutif */}
              {report.executiveSummary && (
                <section className="report-section">
                  <h2>{t('reports.viewer.section_summary')}</h2>
                  <div className="summary-box">
                    <p>{report.executiveSummary}</p>
                  </div>
                </section>
              )}

              {/* Parc Informatique */}
              {stats.assets && (
                <section className="report-section">
                  <h2>1. {t('reports.viewer.section_assets')}</h2>
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.assets.total}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_total_assets')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.assets.enService}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_in_service')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.assets.enPanne}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_broken')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.assets.availability}%</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_availability')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.assets.sousGarantie}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_under_warranty')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.assets.garantieExpiree}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_warranty_expired')}</div>
                    </div>
                  </div>

                  {stats.assets.byType && stats.assets.byType.length > 0 && (
                    <div className="chart-container">
                      <h3>{t('reports.viewer.chart_by_type')}</h3>
                      <Doughnut
                        data={{
                          labels: stats.assets.byType.map((t) => t.type),
                          datasets: [
                            {
                              data: stats.assets.byType.map((t) => t.count),
                              backgroundColor: [
                                'rgb(255, 99, 132)',
                                'rgb(54, 162, 235)',
                                'rgb(255, 206, 86)',
                                'rgb(75, 192, 192)',
                                'rgb(153, 102, 255)',
                                'rgb(255, 159, 64)',
                              ],
                            },
                          ],
                        }}
                        options={{ responsive: true, maintainAspectRatio: true }}
                      />
                    </div>
                  )}

                  {stats.assets.byStatus && stats.assets.byStatus.length > 0 && (
                    <div className="chart-container">
                      <h3>{t('reports.viewer.chart_by_status')}</h3>
                      <Pie
                        data={{
                          labels: stats.assets.byStatus.map((s) => s.status),
                          datasets: [
                            {
                              data: stats.assets.byStatus.map((s) => s.count),
                              backgroundColor: [
                                'rgb(75, 192, 192)',
                                'rgb(255, 99, 132)',
                                'rgb(255, 206, 86)',
                                'rgb(54, 162, 235)',
                                'rgb(153, 102, 255)',
                              ],
                            },
                          ],
                        }}
                        options={{ responsive: true, maintainAspectRatio: true }}
                      />
                    </div>
                  )}

                  {stats.assets.byBrand && stats.assets.byBrand.length > 0 && (
                    <div className="table-container">
                      <h3>{t('reports.viewer.table_top_brands')}</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Marque</th>
                            <th>Quantité</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.assets.byBrand.slice(0, 10).map((brand, idx) => (
                            <tr key={idx}>
                              <td>{brand.brand}</td>
                              <td>{brand.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {stats.assets.criticalAssets && stats.assets.criticalAssets.length > 0 && (
                    <div className="alert alert-danger">
                      <h4>⚠️ Équipements Critiques</h4>
                      <p>{stats.assets.criticalAssets.length} équipements nécessitent une attention immédiate :</p>
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Tag</th>
                              <th>Type</th>
                              <th>Marque</th>
                              <th>Score</th>
                              <th>Niveau</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.assets.criticalAssets.slice(0, 10).map((asset, idx) => (
                              <tr key={idx}>
                                <td>{asset.asset_tag}</td>
                                <td>{asset.type || 'N/A'}</td>
                                <td>{asset.brand || 'N/A'}</td>
                                <td>{asset.risk_score}/100</td>
                                <td>
                                  <span className={`badge badge-${asset.risk_level === 'critique' ? 'danger' : 'warning'}`}>
                                    {asset.risk_level}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Section Utilisateurs */}
              {stats.users && (
                <section className="report-section">
                  <h2>2. {t('reports.viewer.section_users')}</h2>
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.users.total}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_total_users')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.users.actifs}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_active_users')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.users.inactifs}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_inactive_users')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.users.enAttente}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_pending_users')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.users.withoutAssets}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_users_without_assets')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.users.avgAssetsPerUser.toFixed(2)}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_avg_assets_per_user')}</div>
                    </div>
                  </div>

                  {stats.users.byRole && stats.users.byRole.length > 0 && (
                    <div className="chart-container">
                      <h3>{t('reports.viewer.chart_by_role')}</h3>
                      <Bar
                        data={{
                          labels: stats.users.byRole.map((r) => r.role),
                          datasets: [
                            {
                              label: t('reports.viewer.dataset_users_count'),
                              data: stats.users.byRole.map((r) => r.count),
                              backgroundColor: 'rgb(54, 162, 235)',
                            },
                          ],
                        }}
                        options={{ responsive: true, maintainAspectRatio: true }}
                      />
                    </div>
                  )}

                  {stats.users.byDirection && stats.users.byDirection.length > 0 && (
                    <div className="table-container">
                      <h3>{t('reports.viewer.table_by_direction')}</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Direction</th>
                            <th>Nombre</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.users.byDirection.map((dir, idx) => (
                            <tr key={idx}>
                              <td>{dir.direction}</td>
                              <td>{dir.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {stats.users.lastLogins && stats.users.lastLogins.length > 0 && (
                    <div className="table-container">
                      <h3>{t('reports.viewer.table_last_logins')}</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Utilisateur</th>
                            <th>Email</th>
                            <th>Direction</th>
                            <th>Dernière Connexion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.users.lastLogins.slice(0, 10).map((login, idx) => (
                            <tr key={idx}>
                              <td>{login.username}</td>
                              <td>{login.email}</td>
                              <td>{login.direction || 'N/A'}</td>
                              <td>{login.last_login ? new Date(login.last_login).toLocaleString('fr-FR') : 'Jamais'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* Section Tickets */}
              {stats.tickets && (
                <section className="report-section">
                  <h2>3. {t('reports.viewer.section_tickets')}</h2>
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.tickets.total}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_total_tickets')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">
                        {stats.tickets.nouveau + stats.tickets.assigne + stats.tickets.enCours}
                      </div>
                      <div className="kpi-label">{t('reports.viewer.kpi_open_tickets')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">
                        {stats.tickets.resolu + stats.tickets.cloture}
                      </div>
                      <div className="kpi-label">{t('reports.viewer.kpi_resolved_tickets')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.tickets.slaCompliance}%</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_sla_compliance')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.tickets.avgResolutionTime}h</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_avg_resolution')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.tickets.backlog}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_backlog')}</div>
                    </div>
                  </div>

                  {stats.tickets.byPriority && stats.tickets.byPriority.length > 0 && (
                    <div className="chart-container">
                      <h3>{t('reports.viewer.chart_by_priority')}</h3>
                      <Doughnut
                        data={{
                          labels: stats.tickets.byPriority.map((p) => p.priority),
                          datasets: [
                            {
                              data: stats.tickets.byPriority.map((p) => p.count),
                              backgroundColor: [
                                'rgb(255, 99, 132)',
                                'rgb(255, 206, 86)',
                                'rgb(54, 162, 235)',
                                'rgb(75, 192, 192)',
                              ],
                            },
                          ],
                        }}
                        options={{ responsive: true, maintainAspectRatio: true }}
                      />
                    </div>
                  )}

                  {stats.tickets.byCategory && stats.tickets.byCategory.length > 0 && (
                    <div className="table-container">
                      <h3>{t('reports.viewer.table_by_category')}</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Catégorie</th>
                            <th>Nombre</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.tickets.byCategory.map((cat, idx) => (
                            <tr key={idx}>
                              <td>{cat.category}</td>
                              <td>{cat.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {stats.tickets.byTechnician && stats.tickets.byTechnician.length > 0 && (
                    <div className="table-container">
                      <h3>{t('reports.viewer.table_by_technician')}</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Technicien</th>
                            <th>Tickets Assignés</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.tickets.byTechnician.slice(0, 10).map((tech, idx) => (
                            <tr key={idx}>
                              <td>{tech.technician}</td>
                              <td>{tech.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {stats.tickets.evolution && stats.tickets.evolution.length > 0 && (
                    <div className="chart-container">
                      <h3>{t('reports.viewer.chart_evolution')}</h3>
                      <Line
                        data={{
                          labels: stats.tickets.evolution.map((e) => e.date),
                          datasets: [
                            {
                              label: t('reports.viewer.dataset_tickets_created'),
                              data: stats.tickets.evolution.map((e) => e.count),
                              borderColor: 'rgb(54, 162, 235)',
                              backgroundColor: 'rgba(54, 162, 235, 0.1)',
                              tension: 0.4,
                            },
                          ],
                        }}
                        options={{ responsive: true, maintainAspectRatio: true }}
                      />
                    </div>
                  )}
                </section>
              )}

              {/* Section Sécurité */}
              {stats.security && (
                <section className="report-section">
                  <h2>4. {t('reports.viewer.section_security')}</h2>
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.security.total}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_total_incidents')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.security.critical}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_critical_incidents')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.security.high}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_high_incidents')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.security.open}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_open_incidents')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.security.resolved}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_resolved_incidents')}</div>
                    </div>
                  </div>

                  {stats.security.byType && stats.security.byType.length > 0 && (
                    <div className="chart-container">
                      <h3>{t('reports.viewer.chart_by_type')}</h3>
                      <Bar
                        data={{
                          labels: stats.security.byType.map((t) => t.type),
                          datasets: [
                            {
                              label: t('reports.viewer.dataset_incidents_count'),
                              data: stats.security.byType.map((t) => t.count),
                              backgroundColor: 'rgb(255, 99, 132)',
                            },
                          ],
                        }}
                        options={{ responsive: true, maintainAspectRatio: true }}
                      />
                    </div>
                  )}

                  {stats.security.highRiskAssets && stats.security.highRiskAssets.length > 0 && (
                    <div className="alert alert-warning">
                      <h4>⚠️ Équipements à Risque Élevé</h4>
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Tag</th>
                              <th>Type</th>
                              <th>Marque</th>
                              <th>Score</th>
                              <th>Niveau</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.security.highRiskAssets.slice(0, 10).map((asset, idx) => (
                              <tr key={idx}>
                                <td>{asset.asset_tag}</td>
                                <td>{asset.type || 'N/A'}</td>
                                <td>{asset.brand || 'N/A'}</td>
                                <td>{asset.risk_score}/100</td>
                                <td>
                                  <span className={`badge badge-${asset.risk_level === 'critique' ? 'danger' : 'warning'}`}>
                                    {asset.risk_level}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Section Découverte Réseau */}
              {stats.network && (
                <section className="report-section">
                  <h2>5. {t('reports.viewer.section_network')}</h2>
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.network.total}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_total_detected')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.network.unresolved}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_unresolved')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.network.resolved}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_resolved')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.network.newDevices}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_new_devices')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.network.offlineDevices}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_offline')}</div>
                    </div>
                  </div>
                </section>
              )}

              {/* Section Assistant IA */}
              {stats.ai && (
                <section className="report-section">
                  <h2>6. {t('reports.viewer.section_ai')}</h2>
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.ai.totalSessions}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_ai_sessions')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.ai.totalMessages}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_ai_messages')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.ai.autoTicketsCreated}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_ai_auto_tickets')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.ai.autoResolutionRate}%</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_ai_resolution_rate')}</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.ai.avgProcessingTime}s</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_ai_avg_processing')}</div>
                    </div>
                  </div>

                  {stats.ai.intents && stats.ai.intents.length > 0 && (
                    <div className="table-container">
                      <h3>{t('reports.viewer.table_ai_intents')}</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Intention</th>
                            <th>Nombre</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.ai.intents.map((intent, idx) => (
                            <tr key={idx}>
                              <td>{intent.intent}</td>
                              <td>{intent.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* Section Activité Plateforme */}
              {stats.platform && (
                <section className="report-section">
                  <h2>7. {t('reports.viewer.section_platform')}</h2>
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-value">{stats.platform.totalLogins}</div>
                      <div className="kpi-label">{t('reports.viewer.kpi_total_logins')}</div>
                    </div>
                  </div>

                  {stats.platform.activityByUser && stats.platform.activityByUser.length > 0 && (
                    <div className="table-container">
                      <h3>{t('reports.viewer.table_top_active_users')}</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Utilisateur</th>
                            <th>Email</th>
                            <th>Direction</th>
                            <th>Actions</th>
                            <th>Dernière Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.platform.activityByUser.slice(0, 10).map((user, idx) => (
                            <tr key={idx}>
                              <td>{user.username}</td>
                              <td>{user.email}</td>
                              <td>{user.direction || 'N/A'}</td>
                              <td>{user.action_count}</td>
                              <td>{user.last_action ? new Date(user.last_action).toLocaleString('fr-FR') : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
