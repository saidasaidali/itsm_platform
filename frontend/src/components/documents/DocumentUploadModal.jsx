import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CAlert,
  CButton,
  CFormInput,
  CFormLabel,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCloudUpload, cilX } from '@coreui/icons'
import { uploadDocument } from '../../services/documentService.js'

/**
 * Modale d'upload d'un fichier PDF.
 *
 * Props :
 * - visible : boolean
 * - onClose : () => void
 * - onUploadSuccess : () => void (callback appelée après upload réussi)
 */
const DocumentUploadModal = ({ visible, onClose, onUploadSuccess }) => {
  const { t } = useTranslation()
  const fileInputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const handleClose = () => {
    setFile(null)
    setCategory('')
    setTags('')
    setError(null)
    onClose()
  }

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      setFile(selected)
      setError(null)
    }
  }

  const handleSubmit = async () => {
    if (!file) {
      setError(t('documents.upload.error_no_file'))
      return
    }

    setUploading(true)
    setError(null)

    try {
      const tagsArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      await uploadDocument(file, category || null, tagsArray)
      onUploadSuccess()
      handleClose()
    } catch (err) {
      // Gérer le code 409 (doublon) retourné par le backend
      if (err.response?.status === 409) {
        setError(err.response?.data?.message || t('documents.upload.error_duplicate'))
      } else {
        setError(err.response?.data?.message || err.message || t('common.error'))
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <CModal visible={visible} onClose={handleClose} size="lg">
      <CModalHeader>
        <h5 className="modal-title">{t('documents.upload.title')}</h5>
        <CButton color="transparent" onClick={handleClose}>
          <CIcon icon={cilX} />
        </CButton>
      </CModalHeader>
      <CModalBody>
        {error && (
          <CAlert color={error.includes('existe déjà') ? 'warning' : 'danger'} dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}

        <div className="row g-3">
          {/* Fichier PDF */}
          <div className="col-12">
            <CFormLabel>{t('documents.upload.file_label')}</CFormLabel>
            <div className="d-flex align-items-center gap-2">
              <CButton
                color="outline-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <CIcon icon={cilCloudUpload} className="me-1" />
                {file ? file.name : t('documents.upload.file_placeholder')}
              </CButton>
              {file && (
                <small className="text-muted">
                  {(file.size / 1024 / 1024).toFixed(2)} Mo
                </small>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="d-none"
              onChange={handleFileChange}
            />
          </div>

          {/* Catégorie */}
          <div className="col-12 col-md-6">
            <CFormLabel>{t('documents.upload.category_label')}</CFormLabel>
            <CFormInput
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('documents.upload.category_placeholder')}
              disabled={uploading}
            />
          </div>

          {/* Tags */}
          <div className="col-12 col-md-6">
            <CFormLabel>{t('documents.upload.tags_label')}</CFormLabel>
            <CFormInput
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('documents.upload.tags_placeholder')}
              disabled={uploading}
            />
          </div>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={handleClose} disabled={uploading}>
          {t('common.cancel')}
        </CButton>
        <CButton color="primary" onClick={handleSubmit} disabled={uploading || !file}>
          {uploading ? (
            <>
              <CSpinner size="sm" className="me-1" />
              {t('documents.upload.uploading')}
            </>
          ) : (
            t('documents.upload.submit')
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default DocumentUploadModal