import React from 'react'
import { CButton, CBadge, CModal, CModalHeader, CModalBody, CModalFooter } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilX,
  cilLink,
  cilPencil,
  cilTrash,
  cilClock,
  cilMap,
  cilBuilding,
  cilLocationPin,
  cilNotes,
  cilCopy,
} from '@coreui/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { EVENT_TYPES, EVENT_STATUSES } from '../../services/calendarService'

const STATUS_COLORS = {
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
  postponed: 'secondary',
}

/**
 * Modal de détail d'un événement - version modernisée
 *
 * Props :
 * - visible : boolean
 * - event : object | null
 * - canEdit : boolean
 * - canDelete : boolean
 * - onClose : () => void
 * - onEdit : () => void
 * - onDelete : () => void
 */
const EventDetailModal = React.memo(
  ({ visible, event, canEdit, canDelete, onClose, onEdit, onDelete, onDuplicate }) => {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()

    if (!event) return null

    const handleClose = () => {
      onClose()
    }

    const eventColor = event.color || EVENT_TYPES[event.event_type]?.color || '#6c757d'

    return (
      <CModal visible={visible} onClose={handleClose} size="lg" className="calendar-modal">
        <CModalHeader>
          <h5 className="modal-title">{event.title}</h5>
          <CButton color="transparent" onClick={handleClose}>
            <CIcon icon={cilX} />
          </CButton>
        </CModalHeader>
        <CModalBody>
          <div className="d-flex gap-2 mb-3 flex-wrap">
            <span className="event-type-badge" style={{ backgroundColor: eventColor }}>
              {t(`calendar.types.${event.event_type}`) ||
                EVENT_TYPES[event.event_type]?.label ||
                event.event_type}
            </span>
            <CBadge
              className="event-status-badge"
              color={STATUS_COLORS[event.status] || 'secondary'}
            >
              {t(`calendar.statuses.${event.status}`) ||
                EVENT_STATUSES[event.status] ||
                event.status}
            </CBadge>
          </div>

          {event.description && (
            <div
              className="p-3 mb-3 rounded-3"
              style={{
                background: 'rgba(41, 128, 185, 0.05)',
                borderLeft: `3px solid ${eventColor}`,
              }}
            >
              <p className="text-muted mb-0">{event.description}</p>
            </div>
          )}

          <div className="row g-3">
            <div className="col-12 col-md-6">
              <div className="d-flex align-items-center gap-2 mb-1">
                <CIcon icon={cilClock} className="text-secondary" size="sm" />
                <strong>{t('calendar.form.start_date_label')}</strong>
              </div>
              <div className="ps-4">{new Date(event.start_date).toLocaleString(i18n.language)}</div>
            </div>
            <div className="col-12 col-md-6">
              <div className="d-flex align-items-center gap-2 mb-1">
                <CIcon icon={cilClock} className="text-secondary" size="sm" />
                <strong>{t('calendar.form.end_date_label')}</strong>
              </div>
              <div className="ps-4">{new Date(event.end_date).toLocaleString(i18n.language)}</div>
            </div>

            {event.location && (
              <div className="col-12">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <CIcon icon={cilLocationPin} className="text-secondary" size="sm" />
                  <strong>{t('calendar.form.location_label')}</strong>
                </div>
                <div className="ps-4">{event.location}</div>
              </div>
            )}

            {event.department && (
              <div className="col-12 col-md-6">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <CIcon icon={cilBuilding} className="text-secondary" size="sm" />
                  <strong>{t('calendar.form.department_label')}</strong>
                </div>
                <div className="ps-4">{event.department}</div>
              </div>
            )}

            {event.site && (
              <div className="col-12 col-md-6">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <CIcon icon={cilMap} className="text-secondary" size="sm" />
                  <strong>{t('calendar.form.site_label')}</strong>
                </div>
                <div className="ps-4">{event.site}</div>
              </div>
            )}

            {event.ticket_id && (
              <div className="col-12">
                <CButton
                  color="link"
                  className="text-decoration-none p-0"
                  onClick={() => {
                    handleClose()
                    navigate(`/tickets/${event.ticket_id}`)
                  }}
                >
                  <CIcon icon={cilLink} className="me-2" />
                  {t('calendar.form.ticket_label')} #{event.ticket_id} - {event.ticket_title}
                </CButton>
              </div>
            )}

            {event.asset_id && (
              <div className="col-12">
                <CButton
                  color="link"
                  className="text-decoration-none p-0"
                  onClick={() => {
                    handleClose()
                    navigate(`/assets/${event.asset_id}`)
                  }}
                >
                  <CIcon icon={cilLink} className="me-2" />
                  {t('calendar.form.asset_label')} {event.asset_tag} ({event.asset_type})
                </CButton>
              </div>
            )}

            {event.assigned_to && (
              <div className="col-12 col-md-6">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <CIcon icon={cilMap} className="text-secondary" size="sm" />
                  <strong>{t('calendar.form.assigned_to_label')}</strong>
                </div>
                <div className="ps-4">{event.assigned_to_name || `#${event.assigned_to}`}</div>
              </div>
            )}

            {event.notes && (
              <div className="col-12">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <CIcon icon={cilNotes} className="text-secondary" size="sm" />
                  <strong>{t('calendar.form.notes_label')}</strong>
                </div>
                <div className="p-3 rounded-3" style={{ background: 'rgba(0,0,0,0.02)' }}>
                  <p className="text-muted mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                    {event.notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CModalBody>
        <CModalFooter>
          {canEdit && (
            <>
              <CButton color="primary" onClick={onEdit}>
                <CIcon icon={cilPencil} className="me-2" />
                {t('calendar.actions.edit_event')}
              </CButton>
              {onDuplicate && (
                <CButton color="info" variant="outline" onClick={onDuplicate}>
                  <CIcon icon={cilCopy} className="me-2" />
                  {t('calendar.actions.duplicate_event')}
                </CButton>
              )}
            </>
          )}
          {canDelete && (
            <CButton color="danger" variant="outline" onClick={onDelete}>
              <CIcon icon={cilTrash} className="me-2" />
              {t('calendar.actions.delete_event')}
            </CButton>
          )}
          <CButton color="secondary" variant="ghost" onClick={handleClose}>
            {t('common.close')}
          </CButton>
        </CModalFooter>
      </CModal>
    )
  },
)

EventDetailModal.displayName = 'EventDetailModal'

export default EventDetailModal
