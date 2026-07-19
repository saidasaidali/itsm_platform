import React, { useEffect, useState, useContext, useRef } from 'react'
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
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilTrash, cilReload } from '@coreui/icons'
import {
  getDocuments,
  deleteDocument,
  reindexDocument,
} from '../../services/documentService.js'
import DocumentUploadModal from '../../components/documents/DocumentUploadModal'

const STATUS_COLORS = {
  pending: 'warning',
  processing: 'secondary',
  indexed: 'success',
  error: 'danger',
}

const DocumentsList = () => {
  const { t } = useTranslation()
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role

  usePageTitle('documents.list.title', 'Gestion des fiches PDF')

  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [error, setError] = useState(null)
  const documentsRef = useRef(documents)

  // Mettre à jour la ref quand documents change
  useEffect(() => {
    documentsRef.current = documents
  }, [documents])

  const loadDocuments = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDocuments()
      setDocuments(data)
    } catch (err) {
      console.error(err)
      setError(err.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
    
    // Polling automatique pour détecter les changements de statut
    // (indexation en arrière-plan, OCR, etc.)
    const interval = setInterval(() => {
      const hasProcessing = documentsRef.current.some(doc => doc.status === 'processing')
      if (hasProcessing) {
        loadDocuments()
      }
    }, 5000) // Vérifier toutes les 5 secondes

    return () => clearInterval(interval)
  }, []) // Dépendances vides : exécuté une seule fois au montage

  const handleDelete = async (id) => {
    try {
      await deleteDocument(id)
      setDeleteConfirm(null)
      await loadDocuments()
    } catch (err) {
      console.error(err)
      setError(err.message || t('common.error'))
    }
  }

  const handleReindex = async (id) => {
    try {
      await reindexDocument(id)
      await loadDocuments()
    } catch (err) {
      console.error(err)
      setError(err.message || t('common.error'))
    }
  }

  const translateStatus = (status) =>
    t(`documents.status.${status}`, { defaultValue: status })

  return (
    <>
      {error && (
        <CAlert color="danger" dismissible onClose={() => setError(null)}>
          {error}
        </CAlert>
      )}

      <CRow className="mb-3 align-items-center">
        <CCol>
          <h3 className="mb-0">{t('documents.list.title')}</h3>
          <small className="text-muted">
            {t('documents.list.total', { count: documents.length })}
          </small>
        </CCol>
        {role === 'Admin' && (
          <CCol xs="auto">
            <CButton color="primary" onClick={() => setShowUploadModal(true)}>
              <CIcon icon={cilCloudUpload} className="me-1" />
              {t('documents.list.add')}
            </CButton>
          </CCol>
        )}
      </CRow>

      <CCard>
        <CCardHeader className="d-flex justify-content-between">
          <strong>{t('documents.list.table_title')}</strong>
          <span className="text-muted small">
            {t('common.results_count', { count: documents.length })}
          </span>
        </CCardHeader>
        <CCardBody className="p-0">
          {loading ? (
            <div className="text-center p-4">
              <CSpinner />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center text-muted p-4">
              {t('documents.list.empty')}
            </div>
          ) : (
            <CTable hover responsive className="mb-0">
              <CTableHead color="light">
                <CTableRow>
                  <CTableHeaderCell>{t('documents.fields.filename')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('documents.fields.category')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('documents.fields.status')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('documents.fields.chunks')}</CTableHeaderCell>
                  <CTableHeaderCell>{t('documents.fields.created_at')}</CTableHeaderCell>
                  <CTableHeaderCell></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {documents.map((doc) => (
                  <CTableRow key={doc.id}>
                    <CTableDataCell>
                      <strong>{doc.original_filename}</strong>
                    </CTableDataCell>
                    <CTableDataCell>
                      {doc.category || <em className="text-muted">—</em>}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={STATUS_COLORS[doc.status] || 'secondary'}>
                        {translateStatus(doc.status)}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      {doc.chunk_count != null ? doc.chunk_count : <em className="text-muted">—</em>}
                    </CTableDataCell>
                    <CTableDataCell>
                      {doc.created_at
                        ? new Date(doc.created_at).toLocaleDateString('fr-FR')
                        : <em className="text-muted">—</em>}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="d-flex gap-1">
                        {(doc.status === 'error' || doc.status === 'indexed') && (
                          <CButton
                            color="outline-warning"
                            size="sm"
                            title={t('documents.actions.reindex')}
                            onClick={() => handleReindex(doc.id)}
                          >
                            <CIcon icon={cilReload} />
                          </CButton>
                        )}
                        <CButton
                          color="outline-danger"
                          size="sm"
                          title={t('documents.actions.delete')}
                          onClick={() => setDeleteConfirm(doc.id)}
                        >
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      {/* Modale de confirmation de suppression */}
      <CModal visible={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)}>
        <CModalHeader>
          <CModalTitle>{t('documents.delete.title')}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {t('documents.delete.confirm')}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setDeleteConfirm(null)}>
            {t('common.cancel')}
          </CButton>
          <CButton
            color="danger"
            onClick={() => handleDelete(deleteConfirm)}
          >
            {t('common.delete')}
          </CButton>
        </CModalFooter>
      </CModal>

      <DocumentUploadModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={() => {
          setShowUploadModal(false)
          loadDocuments()
        }}
      />
    </>
  )
}

export default DocumentsList