import React from 'react'
import { CButton, CModal, CModalHeader, CModalBody, CModalFooter } from '@coreui/react'
import { useTranslation } from 'react-i18next'

/**
 * Modal de confirmation de suppression d'événement
 *
 * Props :
 * - visible : boolean
 * - onClose : () => void
 * - onConfirm : () => void
 */
const EventDeleteModal = React.memo(({ visible, onClose, onConfirm }) => {
  const { t } = useTranslation()

  return (
    <CModal visible={visible} onClose={onClose}>
      <CModalHeader>
        <h5 className="modal-title">{t('calendar.form.delete_confirm')}</h5>
      </CModalHeader>
      <CModalBody>
        <p>{t('calendar.form.delete_confirm')}</p>
        <p className="text-danger small">{t('calendar.form.delete_confirm_warning')}</p>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          {t('calendar.form.cancel')}
        </CButton>
        <CButton color="danger" onClick={onConfirm}>
          {t('calendar.actions.delete_event')}
        </CButton>
      </CModalFooter>
    </CModal>
  )
})

EventDeleteModal.displayName = 'EventDeleteModal'

export default EventDeleteModal
