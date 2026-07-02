// frontend/src/views/reports/Reports.jsx
import React, { useState, useEffect } from 'react';
import { CButton, CCard, CCardBody, CCardHeader, CCol, CRow, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow, CFormSelect, CFormInput, CAlert, CSpinner, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react';
import { reportService } from '../../services/reportService';
import { useTranslation } from 'react-i18next';

const Reports = () => {
  const { t } = useTranslation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 0 });

  // Form state
  const [reportType, setReportType] = useState('monthly');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Load reports on mount
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const result = await reportService.getReports(page, 20);
      setReports(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError('Erreur lors du chargement des rapports');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!periodStart || !periodEnd) {
      setError('Veuillez sélectionner les dates de début et de fin');
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      setSuccess(null);

      await reportService.generateReport(reportType, periodStart, periodEnd);

      setSuccess('Rapport généré avec succès!');
      setShowGenerateModal(false);
      setPeriodStart('');
      setPeriodEnd('');

      // Reload reports list
      await loadReports();

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la génération du rapport');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce rapport?')) {
      return;
    }

    try {
      await reportService.deleteReport(reportId);
      setSuccess('Rapport supprimé avec succès');
      await loadReports();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError('Erreur lors de la suppression du rapport');
      console.error(err);
    }
  };

  const handleDownloadReport = async (reportId) => {
    try {
      const blob = await reportService.downloadReport(reportId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport_${reportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Erreur lors du téléchargement du rapport');
      console.error(err);
    }
  };

  const getReportTypeLabel = (type) => {
    switch (type) {
      case 'monthly': return 'Mensuel';
      case 'weekly': return 'Hebdomadaire';
      case 'custom': return 'Personnalisé';
      default: return type;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return <span className="badge bg-success">Complété</span>;
      case 'generating': return <span className="badge bg-warning">En cours</span>;
      case 'failed': return <span className="badge bg-danger">Échoué</span>;
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-4">
      <CRow>
        <CCol xs={12}>
          <CCard>
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <h4 className="mb-0">Rapports IA</h4>
              <CButton color="primary" onClick={() => setShowGenerateModal(true)}>
                <i className="fas fa-plus me-2"></i>
                Générer un Rapport
              </CButton>
            </CCardHeader>
            <CCardBody>
              {error && <CAlert color="danger" onClose={() => setError(null)} dismissible>{error}</CAlert>}
              {success && <CAlert color="success" onClose={() => setSuccess(null)} dismissible>{success}</CAlert>}

              {loading ? (
                <div className="text-center p-5">
                  <CSpinner color="primary" />
                  <p className="mt-3">Chargement des rapports...</p>
                </div>
              ) : (
                <>
                  <CTable striped hover responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>ID</CTableHeaderCell>
                        <CTableHeaderCell>Type</CTableHeaderCell>
                        <CTableHeaderCell>Période</CTableHeaderCell>
                        <CTableHeaderCell>Généré par</CTableHeaderCell>
                        <CTableHeaderCell>Date de génération</CTableHeaderCell>
                        <CTableHeaderCell>Statut</CTableHeaderCell>
                        <CTableHeaderCell>Actions</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {!reports || reports.length === 0 ? (
                        <CTableRow>
                          <CTableDataCell colSpan={7} className="text-center">
                            Aucun rapport disponible
                          </CTableDataCell>
                        </CTableRow>
                      ) : (
                        reports.map((report) => (
                          <CTableRow key={report.id}>
                            <CTableDataCell>#{report.id}</CTableDataCell>
                            <CTableDataCell>{getReportTypeLabel(report.report_type)}</CTableDataCell>
                            <CTableDataCell>
                              {report.period_start} au {report.period_end}
                            </CTableDataCell>
                            <CTableDataCell>{report.generated_by_name || 'N/A'}</CTableDataCell>
                            <CTableDataCell>{formatDate(report.generated_at)}</CTableDataCell>
                            <CTableDataCell>{getStatusLabel(report.status)}</CTableDataCell>
                            <CTableDataCell>
                              {report.status === 'completed' && (
                                <>
                                  <CButton
                                    size="sm"
                                    color="info"
                                    onClick={() => handleDownloadReport(report.id)}
                                    title="Télécharger"
                                  >
                                    <i className="fas fa-download"></i>
                                  </CButton>
                                  {' '}
                                </>
                              )}
                              <CButton
                                size="sm"
                                color="danger"
                                onClick={() => handleDeleteReport(report.id)}
                                title="Supprimer"
                              >
                                <i className="fas fa-trash"></i>
                              </CButton>
                            </CTableDataCell>
                          </CTableRow>
                        ))
                      )}
                    </CTableBody>
                  </CTable>

                  {/* Pagination */}
                  {pagination && pagination.totalPages > 1 && (
                    <div className="d-flex justify-content-center mt-4">
                      <nav>
                        <ul className="pagination">
                          <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                            <button
                              className="page-link"
                              onClick={() => loadReports(pagination.page - 1)}
                              disabled={pagination.page === 1}
                            >
                              Précédent
                            </button>
                          </li>
                          <li className="page-item active">
                            <span className="page-link">
                              {pagination.page} / {pagination.totalPages}
                            </span>
                          </li>
                          <li className={`page-item ${pagination.page === pagination.totalPages ? 'disabled' : ''}`}>
                            <button
                              className="page-link"
                              onClick={() => loadReports(pagination.page + 1)}
                              disabled={pagination.page === pagination.totalPages}
                            >
                              Suivant
                            </button>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  )}
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Generate Report Modal */}
      <CModal visible={showGenerateModal} onClose={() => setShowGenerateModal(false)}>
        <CModalHeader>
          <CModalTitle>Générer un Nouveau Rapport</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className="mb-3">
            <CCol md={12}>
              <label className="form-label">Type de Rapport</label>
              <CFormSelect
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="monthly">Mensuel</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="custom">Personnalisé</option>
              </CFormSelect>
            </CCol>
          </CRow>

          <CRow className="mb-3">
            <CCol md={6}>
              <label className="form-label">Date de Début</label>
              <CFormInput
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </CCol>
            <CCol md={6}>
              <label className="form-label">Date de Fin</label>
              <CFormInput
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </CCol>
          </CRow>

          {error && <CAlert color="danger">{error}</CAlert>}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowGenerateModal(false)} disabled={generating}>
            Annuler
          </CButton>
          <CButton color="primary" onClick={handleGenerateReport} disabled={generating}>
            {generating ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Génération en cours...
              </>
            ) : (
              'Générer le Rapport'
            )}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  );
};

export default Reports;