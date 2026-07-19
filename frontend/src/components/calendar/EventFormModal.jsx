import React, { useState } from 'react'
import {
  CButton,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CAlert,
  CBadge,
  CProgress,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilX, cilLightbulb, cilUser, cilClock, cilCalendar } from '@coreui/icons'
import { useTranslation } from 'react-i18next'
import { EVENT_TYPES, EVENT_STATUSES } from '../../services/calendarService'
import {
  suggestBestDate,
  detectConflicts,
  recommendTechnician,
  suggestBestDuration,
} from '../../services/calendarSmartAssistantService'

/**
 * Modal de création / édition d'événement - avec récurrence et participants
 *
 * Props :
 * - visible : boolean
 * - editingEvent : object | null
 * - formData : object
 * - submitting : boolean
 * - onClose : () => void
 * - onSubmit : () => void
 * - onFormChange : (field, value) => void
 * - onEventTypeChange : (type) => void
 * - availableUsers : array (pour les participants)
 */
const EventFormModal = React.memo(
  ({
    visible,
    editingEvent,
    formData,
    submitting,
    onClose,
    onSubmit,
    onFormChange,
    onEventTypeChange,
    availableUsers = [],
  }) => {
    const { t } = useTranslation()
    const [userSearch, setUserSearch] = useState('')
    const [smartLoading, setSmartLoading] = useState(false)
    const [smartSuggestions, setSmartSuggestions] = useState(null)
    const [smartError, setSmartError] = useState(null)

    const handleClose = () => {
      onClose()
      setUserSearch('')
      setSmartSuggestions(null)
      setSmartError(null)
    }

    // Smart Assistant : Suggérer la meilleure date
    const handleSuggestDate = async () => {
      if (!formData.event_type || !formData.assigned_to) {
        setSmartError('Veuillez sélectionner un type et un technicien')
        return
      }
      setSmartLoading(true)
      setSmartError(null)
      try {
        const result = await suggestBestDate({
          event_type: formData.event_type,
          duration_hours: 2,
          assigned_to: formData.assigned_to,
          department: formData.department,
          asset_id: formData.asset_id || undefined,
        })
        if (result.success) {
          setSmartSuggestions({ type: 'date', data: result })
          // Appliquer automatiquement la suggestion
          onFormChange('start_date', new Date(result.suggested_date).toISOString().slice(0, 16))
          onFormChange('end_date', new Date(result.suggested_end).toISOString().slice(0, 16))
        } else {
          setSmartError(result.message)
        }
      } catch (err) {
        setSmartError('Erreur lors de la suggestion')
      } finally {
        setSmartLoading(false)
      }
    }

    // Smart Assistant : Recommander un technicien
    const handleRecommendTech = async () => {
      if (!formData.event_type || !formData.start_date || !formData.end_date) {
        setSmartError('Veuillez remplir le type et les dates')
        return
      }
      setSmartLoading(true)
      setSmartError(null)
      try {
        const result = await recommendTechnician(
          formData.event_type,
          formData.start_date,
          formData.end_date,
          formData.department,
        )
        if (result.success) {
          setSmartSuggestions({ type: 'technician', data: result })
          onFormChange('assigned_to', result.recommended_technician.id)
        } else {
          setSmartError(result.message)
        }
      } catch (err) {
        setSmartError('Erreur lors de la recommandation')
      } finally {
        setSmartLoading(false)
      }
    }

    // Smart Assistant : Suggérer la durée
    const handleSuggestDuration = async () => {
      if (!formData.event_type) {
        setSmartError("Veuillez sélectionner un type d'événement")
        return
      }
      setSmartLoading(true)
      setSmartError(null)
      try {
        const result = await suggestBestDuration(
          formData.event_type,
          formData.asset_id,
          formData.description,
        )
        if (result.success) {
          setSmartSuggestions({ type: 'duration', data: result })
          // Calculer et appliquer la durée suggérée
          const start = new Date(formData.start_date || new Date())
          const end = new Date(start.getTime() + result.suggested_duration * 60 * 60 * 1000)
          onFormChange('end_date', end.toISOString().slice(0, 16))
        } else {
          setSmartError(result.message)
        }
      } catch (err) {
        setSmartError('Erreur lors de la suggestion de durée')
      } finally {
        setSmartLoading(false)
      }
    }

    return (
      <CModal visible={visible} onClose={handleClose} size="lg" className="calendar-modal">
        <CModalHeader>
          <h5 className="modal-title">
            {editingEvent ? t('calendar.actions.edit_event') : t('calendar.actions.add_event')}
          </h5>
          <CButton color="transparent" onClick={handleClose}>
            <CIcon icon={cilX} />
          </CButton>
        </CModalHeader>
        <CModalBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit()
            }}
          >
            <div className="row g-3">
              {/* Titre et description */}
              <div className="col-12">
                <CFormLabel>{t('calendar.form.title_label')}</CFormLabel>
                <CFormInput
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => onFormChange('title', e.target.value)}
                  placeholder={t('calendar.form.title_placeholder')}
                />
              </div>
              <div className="col-12">
                <CFormLabel>{t('calendar.form.description_label')}</CFormLabel>
                <CFormTextarea
                  value={formData.description}
                  onChange={(e) => onFormChange('description', e.target.value)}
                  placeholder={t('calendar.form.description_placeholder')}
                  rows={3}
                />
              </div>

              {/* Type et statut */}
              <div className="col-12 col-md-6">
                <CFormLabel>{t('calendar.form.type_label')}</CFormLabel>
                <CFormSelect
                  value={formData.event_type}
                  onChange={(e) => onEventTypeChange(e.target.value)}
                >
                  {Object.entries(EVENT_TYPES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {t(`calendar.types.${key}`) || value.label}
                    </option>
                  ))}
                </CFormSelect>
              </div>
              <div className="col-12 col-md-6">
                <CFormLabel>{t('calendar.form.status_label')}</CFormLabel>
                <CFormSelect
                  value={formData.status}
                  onChange={(e) => onFormChange('status', e.target.value)}
                >
                  {Object.entries(EVENT_STATUSES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {t(`calendar.statuses.${key}`) || value}
                    </option>
                  ))}
                </CFormSelect>
              </div>

              {/* Dates */}
              <div className="col-12 col-md-6">
                <CFormLabel>{t('calendar.form.start_date_label')}</CFormLabel>
                <CFormInput
                  type="datetime-local"
                  required
                  value={formData.start_date}
                  onChange={(e) => onFormChange('start_date', e.target.value)}
                />
              </div>
              <div className="col-12 col-md-6">
                <CFormLabel>{t('calendar.form.end_date_label')}</CFormLabel>
                <CFormInput
                  type="datetime-local"
                  required
                  value={formData.end_date}
                  onChange={(e) => onFormChange('end_date', e.target.value)}
                />
              </div>

              {/* Toute la journée */}
              <div className="col-12">
                <CFormCheck
                  id="allDayCheck"
                  label={t('calendar.form.all_day_label')}
                  checked={formData.all_day}
                  onChange={(e) => onFormChange('all_day', e.target.checked)}
                />
              </div>

              {/* Récurrence */}
              <div className="col-12">
                <hr className="my-1" />
                <CFormCheck
                  id="recurringCheck"
                  label={t('calendar.form.recurring_label')}
                  checked={formData.is_recurring}
                  onChange={(e) => onFormChange('is_recurring', e.target.checked)}
                />
              </div>

              {formData.is_recurring && (
                <>
                  <div className="col-12 col-md-6">
                    <CFormLabel>{t('calendar.form.recurrence_type_label')}</CFormLabel>
                    <CFormSelect
                      value={formData.recurrence_type}
                      onChange={(e) => onFormChange('recurrence_type', e.target.value)}
                      required={formData.is_recurring}
                    >
                      <option value="">--</option>
                      <option value="daily">{t('calendar.form.recurrence_daily')}</option>
                      <option value="weekly">{t('calendar.form.recurrence_weekly')}</option>
                      <option value="monthly">{t('calendar.form.recurrence_monthly')}</option>
                      <option value="yearly">{t('calendar.form.recurrence_yearly')}</option>
                    </CFormSelect>
                  </div>
                  <div className="col-12 col-md-6">
                    <CFormLabel>{t('calendar.form.recurrence_interval_label')}</CFormLabel>
                    <CFormInput
                      type="number"
                      min="1"
                      value={formData.recurrence_interval}
                      onChange={(e) =>
                        onFormChange('recurrence_interval', parseInt(e.target.value) || 1)
                      }
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <CFormLabel>{t('calendar.form.recurrence_end_date_label')}</CFormLabel>
                    <CFormInput
                      type="date"
                      value={formData.recurrence_end_date}
                      onChange={(e) => onFormChange('recurrence_end_date', e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <CFormLabel>{t('calendar.form.recurrence_count_label')}</CFormLabel>
                    <CFormInput
                      type="number"
                      min="1"
                      value={formData.recurrence_count}
                      onChange={(e) =>
                        onFormChange(
                          'recurrence_count',
                          e.target.value ? parseInt(e.target.value) : null,
                        )
                      }
                      placeholder={t('calendar.form.recurrence_count_placeholder')}
                    />
                  </div>
                </>
              )}

              {/* Tickets et équipements */}
              <div className="col-12">
                <hr className="my-1" />
                <small className="text-secondary fw-semibold">
                  {t('calendar.form.ticket_label')} / {t('calendar.form.asset_label')}
                </small>
              </div>
              <div className="col-12 col-md-6">
                <CFormLabel>{t('calendar.form.ticket_label')}</CFormLabel>
                <CFormInput
                  type="number"
                  value={formData.ticket_id}
                  onChange={(e) => onFormChange('ticket_id', e.target.value)}
                  placeholder={t('calendar.form.no_ticket')}
                />
              </div>
              <div className="col-12 col-md-6">
                <CFormLabel>{t('calendar.form.asset_label')}</CFormLabel>
                <CFormInput
                  type="number"
                  value={formData.asset_id}
                  onChange={(e) => onFormChange('asset_id', e.target.value)}
                  placeholder={t('calendar.form.no_asset')}
                />
              </div>

              {/* Smart Assistant */}
              <div className="col-12">
                <hr className="my-1" />
                <div className="d-flex align-items-center gap-2 mb-2">
                  <CIcon icon={cilLightbulb} className="text-primary" />
                  <strong>{t('Smart Assistant') || 'Assistant IA'}</strong>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <CButton
                    color="info"
                    variant="ghost"
                    size="sm"
                    onClick={handleSuggestDate}
                    disabled={smartLoading}
                    title="Suggérer la meilleure date"
                  >
                    <CIcon icon={cilCalendar} className="me-1" />
                    Date optimale
                  </CButton>
                  <CButton
                    color="success"
                    variant="ghost"
                    size="sm"
                    onClick={handleRecommendTech}
                    disabled={smartLoading}
                    title="Recommander le meilleur technicien"
                  >
                    <CIcon icon={cilUser} className="me-1" />
                    Meilleur technicien
                  </CButton>
                  <CButton
                    color="warning"
                    variant="ghost"
                    size="sm"
                    onClick={handleSuggestDuration}
                    disabled={smartLoading}
                    title="Suggérer la durée optimale"
                  >
                    <CIcon icon={cilClock} className="me-1" />
                    Durée optimale
                  </CButton>
                </div>
                {smartLoading && (
                  <div className="mt-2">
                    <CSpinner size="sm" color="primary" /> <small>Analyse en cours...</small>
                  </div>
                )}
                {smartError && (
                  <CAlert color="danger" className="mt-2" size="sm">
                    {smartError}
                  </CAlert>
                )}
                {smartSuggestions && (
                  <CAlert color="success" className="mt-2" size="sm">
                    {smartSuggestions.type === 'date' && (
                      <div>
                        <strong>Date suggérée :</strong>{' '}
                        {new Date(smartSuggestions.data.suggested_date).toLocaleString('fr-FR')}
                        <br />
                        <small>
                          Score: {smartSuggestions.data.score}/100 - {smartSuggestions.data.reason}
                        </small>
                      </div>
                    )}
                    {smartSuggestions.type === 'technician' && (
                      <div>
                        <strong>Technicien recommandé :</strong>{' '}
                        {smartSuggestions.data.recommended_technician.username}
                        <br />
                        <small>
                          Score: {smartSuggestions.data.recommended_technician.score}% -{' '}
                          {smartSuggestions.data.reasoning}
                        </small>
                      </div>
                    )}
                    {smartSuggestions.type === 'duration' && (
                      <div>
                        <strong>Durée suggérée :</strong> {smartSuggestions.data.suggested_duration}
                        h
                        <br />
                        <small>
                          Confiance: {smartSuggestions.data.confidence} -{' '}
                          {smartSuggestions.data.based_on}
                        </small>
                      </div>
                    )}
                  </CAlert>
                )}
              </div>

              {/* Localisation */}
              <div className="col-12">
                <hr className="my-1" />
                <small className="text-secondary fw-semibold">
                  {t('calendar.form.location_label')}
                </small>
              </div>
              <div className="col-12 col-md-6">
                <CFormLabel>{t('calendar.form.assigned_to_label')}</CFormLabel>
                <CFormInput
                  type="number"
                  value={formData.assigned_to}
                  onChange={(e) => onFormChange('assigned_to', e.target.value)}
                  placeholder={t('calendar.form.unassigned')}
                />
              </div>
              <div className="col-12 col-md-6">
                <CFormLabel>{t('calendar.form.department_label')}</CFormLabel>
                <CFormInput
                  type="text"
                  value={formData.department}
                  onChange={(e) => onFormChange('department', e.target.value)}
                  placeholder={t('calendar.form.department_placeholder')}
                />
              </div>
              <div className="col-12 col-md-6">
                <CFormLabel>{t('calendar.form.site_label')}</CFormLabel>
                <CFormInput
                  type="text"
                  value={formData.site}
                  onChange={(e) => onFormChange('site', e.target.value)}
                  placeholder={t('calendar.form.site_placeholder')}
                />
              </div>
              <div className="col-12 col-md-6">
                <CFormLabel>{t('calendar.form.location_label')}</CFormLabel>
                <CFormInput
                  type="text"
                  value={formData.location}
                  onChange={(e) => onFormChange('location', e.target.value)}
                  placeholder={t('calendar.form.location_placeholder')}
                />
              </div>

              {/* Participants */}
              <div className="col-12">
                <hr className="my-1" />
                <CFormLabel>{t('calendar.form.participants_label')}</CFormLabel>
                {availableUsers.length > 0 ? (
                  <>
                    <CFormInput
                      type="text"
                      placeholder={t('calendar.form.search_users_placeholder')}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="mb-2"
                      style={{ maxWidth: '300px' }}
                    />
                    <div
                      className="participants-list"
                      style={{ maxHeight: '300px', overflowY: 'auto' }}
                    >
                      {availableUsers
                        .filter((user) => {
                          if (!userSearch) return true
                          const search = userSearch.toLowerCase()
                          return (
                            user.username.toLowerCase().includes(search) ||
                            (user.division && user.division.toLowerCase().includes(search)) ||
                            (user.service && user.service.toLowerCase().includes(search)) ||
                            (user.email && user.email.toLowerCase().includes(search))
                          )
                        })
                        .map((user) => {
                          const isSelected = formData.participants?.includes(user.id)
                          const participantStatus =
                            formData.participantStatuses?.[user.id] || 'pending'

                          return (
                            <div
                              key={user.id}
                              className="participant-item d-flex align-items-center gap-2 mb-2 p-2 rounded"
                            >
                              <CFormCheck
                                id={`participant-${user.id}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  const currentParticipants = formData.participants || []
                                  const newParticipants = e.target.checked
                                    ? [...currentParticipants, user.id]
                                    : currentParticipants.filter((id) => id !== user.id)
                                  onFormChange('participants', newParticipants)
                                }}
                              />
                              <label
                                htmlFor={`participant-${user.id}`}
                                className="mb-0 flex-grow-1"
                              >
                                {user.username} {user.division ? `(${user.division})` : ''}
                              </label>
                              {isSelected && (
                                <CFormSelect
                                  size="sm"
                                  style={{ width: '150px' }}
                                  value={participantStatus}
                                  onChange={(e) => {
                                    const currentStatuses = formData.participantStatuses || {}
                                    onFormChange('participantStatuses', {
                                      ...currentStatuses,
                                      [user.id]: e.target.value,
                                    })
                                  }}
                                >
                                  <option value="pending">
                                    {t('calendar.participant_status.pending')}
                                  </option>
                                  <option value="accepted">
                                    {t('calendar.participant_status.accepted')}
                                  </option>
                                  <option value="declined">
                                    {t('calendar.participant_status.declined')}
                                  </option>
                                </CFormSelect>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </>
                ) : (
                  <small className="text-muted">{t('calendar.form.no_users_available')}</small>
                )}
              </div>

              {/* Notes */}
              <div className="col-12">
                <CFormLabel>{t('calendar.form.notes_label')}</CFormLabel>
                <CFormTextarea
                  value={formData.notes}
                  onChange={(e) => onFormChange('notes', e.target.value)}
                  placeholder={t('calendar.form.notes_placeholder')}
                  rows={2}
                />
              </div>

              {/* Rappels */}
              <div className="col-12">
                <hr className="my-1" />
                <small className="text-secondary fw-semibold">
                  {t('calendar.form.reminders_label')}
                </small>
              </div>
              <div className="col-12">
                <div className="d-flex gap-4 flex-wrap">
                  <CFormCheck
                    id="reminder1w"
                    label={t('calendar.form.reminder_1w')}
                    checked={formData.reminder_1w}
                    onChange={(e) => onFormChange('reminder_1w', e.target.checked)}
                  />
                  <CFormCheck
                    id="reminder1d"
                    label={t('calendar.form.reminder_1d')}
                    checked={formData.reminder_1d}
                    onChange={(e) => onFormChange('reminder_1d', e.target.checked)}
                  />
                  <CFormCheck
                    id="reminder1h"
                    label={t('calendar.form.reminder_1h')}
                    checked={formData.reminder_1h}
                    onChange={(e) => onFormChange('reminder_1h', e.target.checked)}
                  />
                  <CFormCheck
                    id="reminderStart"
                    label={t('calendar.form.reminder_start')}
                    checked={formData.reminder_start}
                    onChange={(e) => onFormChange('reminder_start', e.target.checked)}
                  />
                </div>
              </div>
            </div>
          </form>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={handleClose}>
            {t('calendar.form.cancel')}
          </CButton>
          <CButton color="primary" onClick={onSubmit} disabled={submitting}>
            {submitting ? <>{t('calendar.form.creating')}</> : <>{t('calendar.form.save')}</>}
          </CButton>
        </CModalFooter>
      </CModal>
    )
  },
)

EventFormModal.displayName = 'EventFormModal'

export default EventFormModal
