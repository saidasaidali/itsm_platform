// frontend/src/views/tickets/TicketDetail.jsx
import React, { useEffect, useState, useContext, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader,
  CCol, CFormCheck, CFormInput, CFormSelect, CFormTextarea,
  CListGroup, CListGroupItem, CModal, CModalBody, CModalFooter,
  CModalHeader, CModalTitle, CRow, CSpinner,
  CToast, CToastBody, CToaster, CToastHeader,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBook, cilArrowRight, cilCheckCircle } from '@coreui/icons'
import {
  getTicketById, updateTicketStatus, assignTicket,
  transferTicket, addComment, startRemoteSession, endRemoteSession,
} from '../../services/ticketService'
import { getActiveTechnicians } from '../../services/userService'
import { getTechnicianRecommendation } from '../../services/recommendationService'
import { 
  getSentimentColor, 
  getEmotionIcon, 
  formatSentiment 
} from '../../services/sentimentService'
import { translateTicketStatus } from '../../utils/translate'

const STATUS_COLORS = {
  'Nouveau':    'secondary',
  'Assigné':    'info',
  'En cours':   'primary',
  'En attente': 'warning',
  'Résolu':     'success',
  'Clôturé':    'dark',
  'Rouvert':    'danger',
}

const TicketDetail = () => {
  const { ticketId } = useParams()
  const navigate     = useNavigate()
  const { t }        = useTranslation()
  const { currentUser } = useContext(AuthContext)
  const role   = currentUser?.role
  const userId = currentUser?.id
  const toaster = useRef()

  const [ticket, setTicket]               = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [toast, addToastMsg]              = useState(0)

  const [comment, setComment]             = useState('')
  const [isInternal, setIsInternal]       = useState(false)
  const [commentSaving, setCommentSaving] = useState(false)

  const [technicians, setTechnicians]     = useState([])
  const [selectedTech, setSelectedTech]   = useState('')
  const [assignModal, setAssignModal]     = useState(false)
  const [transferModal, setTransferModal] = useState(false)
  const [recommendations, setRecommendations] = useState(null)
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [recommendationModal, setRecommendationModal] = useState(false)

  const [remoteModal, setRemoteModal]       = useState(false)
  const [sessionTool, setSessionTool]       = useState('AnyDesk')
  const [sessionId, setSessionId]           = useState('')
  const [sessionUrl, setSessionUrl]         = useState('')
  const [sessionSaving, setSessionSaving]   = useState(false)

  // ── Toast ─────────────────────────────────────────────────────
  const showToast = (message, color = 'danger') => {
    addToastMsg(
      <CToast color={color} autohide delay={4000}>
        <CToastHeader closeButton>
          <strong className="me-auto">{t('ticket_detail.info')}</strong>
        </CToastHeader>
        <CToastBody className={color === 'danger' ? 'text-white' : ''}>
          {message}
        </CToastBody>
      </CToast>
    )
  }

  // ── Chargement ticket ─────────────────────────────────────────
  const fetchTicket = async () => {
    try {
      const data = await getTicketById(ticketId)
      setTicket(data)
    } catch {
      setError(t('ticket_detail.load_error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTicket() }, [ticketId])

  useEffect(() => {
    if (role === 'Admin' || role === 'Technicien') {
      getActiveTechnicians()
        .then(setTechnicians)
        .catch(console.error)
    }
  }, [role])

  // ── Handlers statut ───────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    try {
      await updateTicketStatus(ticketId, newStatus)
      showToast(t('ticket_detail.status_updated', { status: translateTicketStatus(newStatus) }), 'success')
      fetchTicket()
    } catch (e) {
      showToast(e.message || t('ticket_detail.status_error'))
    }
  }

  // ── Handlers assignation / transfert ─────────────────────────
  const handleAssign = async () => {
    try {
      await assignTicket(ticketId, selectedTech)
      showToast(t('ticket_detail.assign_success'), 'success')
      setAssignModal(false)
      setRecommendationModal(false)
      fetchTicket()
    } catch (e) {
      showToast(e.message || t('ticket_detail.error'))
    }
  }

  // ── Recommandation IA ────────────────────────────────────────
  const handleGetRecommendation = async () => {
    setRecommendationLoading(true)
    try {
      const data = await getTechnicianRecommendation(ticket.category, ticket.priority)
      setRecommendations(data)
      setRecommendationModal(true)
    } catch (e) {
      showToast(e.message || t('recommendations.no_technicians'))
    } finally {
      setRecommendationLoading(false)
    }
  }

  const useRecommendation = (techId) => {
    setSelectedTech(techId)
    setRecommendationModal(false)
    setAssignModal(true)
  }

  const handleTransfer = async () => {
    try {
      await transferTicket(ticketId, selectedTech)
      showToast(t('ticket_detail.transfer_success'), 'success')
      setTransferModal(false)
      fetchTicket()
    } catch (e) {
      showToast(e.message || t('ticket_detail.error'))
    }
  }

  // ── Handler commentaire ───────────────────────────────────────
  const handleComment = async () => {
    if (!comment.trim()) return
    setCommentSaving(true)
    try {
      await addComment(ticketId, comment, isInternal)
      setComment('')
      setIsInternal(false)
      fetchTicket()
    } catch (e) {
      showToast(e.message || t('ticket_detail.error'))
    } finally {
      setCommentSaving(false)
    }
  }

  // ── Handlers session à distance ───────────────────────────────
  const handleStartRemoteSession = async () => {
    if (!sessionId.trim() && !sessionUrl.trim()) return
    setSessionSaving(true)
    try {
      await startRemoteSession(ticketId, {
        session_id:  sessionId.trim() || null,
        tool:        sessionTool,
        session_url: sessionUrl.trim() || null,
      })
      showToast(t('ticket_detail.remote_session.start_success'), 'success')
      setRemoteModal(false)
      setSessionId('')
      setSessionUrl('')
      fetchTicket()
    } catch (e) {
      showToast(e.message || t('ticket_detail.remote_session.start_error'))
    } finally {
      setSessionSaving(false)
    }
  }

  const handleEndRemoteSession = async () => {
    try {
      await endRemoteSession(ticketId)
      showToast(t('ticket_detail.remote_session.end_success'), 'success')
      fetchTicket()
    } catch (e) {
      showToast(e.message || t('ticket_detail.error'))
    }
  }

  // ── Gardes de chargement ──────────────────────────────────────
  if (loading) return <div className="text-center p-5"><CSpinner /></div>
  if (error)   return <CAlert color="danger">{error}</CAlert>
  if (!ticket) return <CAlert color="warning">{t('ticket_detail.not_found')}</CAlert>

  // ── Permissions ───────────────────────────────────────────────
  const isAssignedTech = role === 'Technicien' && ticket.assignedToId === userId
  const canComment = role === 'Admin' || role === 'Technicien' ||
    (role === 'Agent' && ticket.createdById === userId)

  const hasSuggestions = ticket.suggestions?.hasSuggestions &&
    !['Résolu', 'Clôturé'].includes(ticket.status) &&
    (role === 'Agent' || role === 'Technicien' || role === 'Admin')

  const translateStatus = (status) => t(`tickets.status.${status}`, { defaultValue: status })
  const translateAction = (action) => t(`ticket_detail.actions.${action}`, { defaultValue: action })

  return (
    <>
      <CToaster ref={toaster} push={toast} placement="top-end" />
      <CRow>

        {/* ── Colonne principale ──────────────────────────────────── */}
        <CCol md={8}>

          {/* ── Infos ticket ── */}
          <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <div>
                <strong>{t('ticket_detail.title', { id: ticket.id })}</strong>
                <span className="ms-2 text-muted">{ticket.title}</span>
              </div>
              <CBadge color={STATUS_COLORS[ticket.status] || 'secondary'} className="fs-6 px-3 py-2">
                {translateStatus(ticket.status)}
              </CBadge>
            </CCardHeader>
            <CCardBody>
              <CRow className="mb-3">
                <CCol md={6}>
                  <p><strong>{t('ticket_detail.priority')}</strong>{' '}
                    {t(`tickets.priority.${ticket.priority}`, { defaultValue: ticket.priority })}
                  </p>
                  <p><strong>{t('ticket_detail.category')}</strong>{' '}
                    {t(`tickets.category.${ticket.category}`, { defaultValue: ticket.category || '—' })}
                  </p>
                  <p><strong>{t('ticket_detail.created_by')}</strong> {ticket.createdBy}</p>
                  <p><strong>{t('ticket_detail.created_at')}</strong> {ticket.createdAt}</p>
                </CCol>
                <CCol md={6}>
                  <p>
                    <strong>{t('ticket_detail.assigned_to')}</strong>{' '}
                    {ticket.assignedTo || (
                      <em className="text-muted">{t('ticket_detail.unassigned')}</em>
                    )}
                  </p>
                  {ticket.dueDate && (
                    <p>
                      <strong>{t('ticket_detail.sla_due')}</strong>{' '}
                      <span className="text-danger fw-semibold">{ticket.dueDate}</span>
                    </p>
                  )}
                  {ticket.resolvedAt && (
                    <p>
                      <strong>{t('ticket_detail.resolved_at')}</strong>{' '}
                      <span className="text-success fw-semibold">{ticket.resolvedAt}</span>
                    </p>
                  )}
                </CCol>
              </CRow>

              <div className="mb-4">
                <strong>{t('ticket_detail.description')}</strong>
                <p className="mt-1">{ticket.description}</p>
              </div>

              {/* ── Session à distance active — visible par l'agent ── */}
              {ticket.remoteSessionId && role === 'Agent' && (
                <div className="p-3 rounded mb-3"
                  style={{ background: 'rgba(37,99,235,0.08)', border: '2px solid #2563eb' }}>
                  <div className="fw-semibold mb-1" style={{ color: '#2563eb' }}>
                    {t('ticket_detail.remote_session.active_title')}
                  </div>
                  <p className="text-muted small mb-2">
                    {t('ticket_detail.remote_session.active_desc', { tool: ticket.remoteSessionTool })}
                  </p>
                  {ticket.remoteSessionId && (
                    <div className="mb-2">
                      <span className="text-muted small">{t('ticket_detail.remote_session.session_id')}</span>
                      <span className="ms-2 fw-bold fs-5" style={{ letterSpacing: '2px' }}>
                        {ticket.remoteSessionId}
                      </span>
                    </div>
                  )}
                  {ticket.remoteSessionUrl && (
                    <a href={ticket.remoteSessionUrl} target="_blank" rel="noopener noreferrer"
                      className="btn btn-primary btn-sm mt-1">
                      {t('ticket_detail.remote_session.join')}
                    </a>
                  )}
                </div>
              )}

              {/* ── Actions Technicien assigné ── */}
              {isAssignedTech && ticket.status === 'Assigné' && (
                <div className="p-3 rounded mb-3"
                  style={{ background: 'rgba(41,128,185,0.08)', border: '1px solid rgba(41,128,185,0.25)' }}>
                  <p className="text-muted small mb-2">{t('ticket_detail.msg_assigned')}</p>
                  <CButton color="primary" onClick={() => handleStatusChange('En cours')}>
                    {t('ticket_detail.btn_take')}
                  </CButton>
                </div>
              )}

              {isAssignedTech && ticket.status === 'En cours' && (
                <div className="p-3 rounded mb-3"
                  style={{ background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.25)' }}>
                  <p className="text-muted small mb-2">{t('ticket_detail.msg_in_progress')}</p>
                  <div className="d-flex gap-2 flex-wrap">
                    <CButton color="success" onClick={() => handleStatusChange('Résolu')}>
                      {t('ticket_detail.btn_resolve')}
                    </CButton>
                    <CButton color="warning" variant="outline" onClick={() => handleStatusChange('En attente')}>
                      {t('ticket_detail.btn_wait')}
                    </CButton>
                  </div>
                </div>
              )}

              {isAssignedTech && ticket.status === 'En attente' && (
                <div className="p-3 rounded mb-3"
                  style={{ background: 'rgba(243,156,18,0.08)', border: '1px solid rgba(243,156,18,0.25)' }}>
                  <p className="text-muted small mb-2">{t('ticket_detail.msg_waiting')}</p>
                  <CButton color="warning" onClick={() => handleStatusChange('En cours')}>
                    {t('ticket_detail.btn_resume')}
                  </CButton>
                </div>
              )}

              {/* ── Session à distance — boutons Technicien assigné ── */}
              {isAssignedTech && !['Résolu', 'Clôturé'].includes(ticket.status) && (
                <div className="mb-3">
                  {!ticket.remoteSessionId ? (
                    <CButton color="info" size="sm"
                      onClick={() => setRemoteModal(true)}>
                      {t('ticket_detail.remote_session.start_btn')}
                    </CButton>
                  ) : (
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <CBadge color="info">
                        {t('ticket_detail.remote_session.active_badge', { tool: ticket.remoteSessionTool })}
                      </CBadge>
                      <CButton color="outline-danger" size="sm"
                        onClick={handleEndRemoteSession}>
                        {t('ticket_detail.remote_session.close_btn')}
                      </CButton>
                    </div>
                  )}
                </div>
              )}

              {/* ── Transfert — technicien assigné seulement ── */}
              {isAssignedTech && !['Résolu', 'Clôturé'].includes(ticket.status) && (
                <div className="mb-3">
                  <CButton color="outline-info" size="sm"
                    onClick={() => { setSelectedTech(''); setTransferModal(true) }}>
                    {t('ticket_detail.btn_transfer')}
                  </CButton>
                </div>
              )}

              {/* ── Actions Admin : assignation manuelle ── */}
              {role === 'Admin' && (
                <div className="mt-2 d-flex gap-2 flex-wrap">
                  <CButton color="warning" size="sm"
                    onClick={() => { setSelectedTech(''); setAssignModal(true) }}>
                    {t('ticket_detail.btn_assign')}
                  </CButton>
                  <CButton color="info" size="sm"
                    onClick={handleGetRecommendation}
                    disabled={recommendationLoading}>
                    {recommendationLoading
                      ? t('recommendations.loading')
                      : t('recommendations.title')}
                  </CButton>
                </div>
              )}

              {/* ── Message lecture seule pour Agent ── */}
              {role === 'Agent' && !ticket.remoteSessionId && (
                <CAlert color="light" className="mt-3 text-muted small border">
                  {t('ticket_detail.msg_agent_readonly')}
                </CAlert>
              )}

              {/* ── Indicateur ticket auto-généré ── */}
              {ticket.isAutoGenerated && (
                <CAlert color="info" className="mt-3 small mb-0">
                  {t('ticket_detail.msg_auto_generated')}
                </CAlert>
              )}

              {/* ── Indicateur de sentiment ── */}
              {ticket.sentiment && ticket.sentiment !== 'neutre' && (
                <div className="mt-3 p-3 rounded" style={{ 
                  background: ticket.sentiment_is_critical ? 'rgba(220,53,69,0.08)' : 'rgba(255,193,7,0.08)',
                  border: `1px solid ${ticket.sentiment_is_critical ? '#dc3545' : '#ffc107'}`
                }}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <CBadge color={getSentimentColor(ticket.sentiment)} className="fs-6">
                      {formatSentiment(ticket.sentiment)}
                    </CBadge>
                    {ticket.sentiment_is_critical && (
                      <CBadge color="danger" className="fs-6">
                        {t('sentiment.critical')}
                      </CBadge>
                    )}
                    <span className="text-muted small">
                      {t('sentiment.score')}: {ticket.sentiment_score}/100 • {t('sentiment.intensity')}: {ticket.sentiment_intensity}/100
                    </span>
                  </div>
                  
                  {ticket.sentiment_emotions && ticket.sentiment_emotions.length > 0 && (
                    <div className="small">
                      <strong>{t('sentiment.emotions')}:</strong>
                      <div className="d-flex gap-2 mt-1">
                        {ticket.sentiment_emotions.map((emotion, idx) => (
                          <CBadge key={idx} color="warning" className="text-dark">
                            {getEmotionIcon(emotion)} {t(`sentiment.${emotion}`)}
                          </CBadge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CCardBody>
          </CCard>

          {/* ── Suggestions de résolution — Agent et Technicien ── */}
          {hasSuggestions && (
            <CCard className="mb-4">
              <CCardHeader>
                <strong>{t('ticket_detail.suggestions_title', { defaultValue: 'Suggestions de résolution' })}</strong>
                <small className="text-muted ms-2">
                  Basées sur la base de connaissances et les tickets similaires résolus
                </small>
              </CCardHeader>
              <CCardBody>

                {/* Articles de la base de connaissances */}
                {ticket.suggestions.articles?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-muted small text-uppercase fw-semibold mb-3"
                      style={{ letterSpacing: '0.06em' }}>
                      Articles de la base de connaissances
                    </div>
                    <div className="d-flex flex-column gap-2">
                      {ticket.suggestions.articles.map((a) => (
                        <div
                          key={a.id}
                          onClick={() => navigate(`/knowledge/${a.id}`)}
                          style={{
                            padding: '14px 16px',
                            borderRadius: 10,
                            border: '1px solid var(--cui-border-color)',
                            background: 'var(--cui-tertiary-bg)',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s, background 0.15s',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#2563eb'
                            e.currentTarget.style.background = 'rgba(37,99,235,0.04)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--cui-border-color)'
                            e.currentTarget.style.background = 'var(--cui-tertiary-bg)'
                          }}
                        >
                          {/* Icône catégorie */}
                          <div style={{
                            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                            background: 'rgba(37,99,235,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <CIcon icon={cilBook} style={{ color: '#2563eb' }} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span className="fw-semibold small">{a.title}</span>
                              <CBadge color="primary" style={{ fontSize: 10 }}>{a.category}</CBadge>
                            </div>
                            <div className="text-muted small" style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}>
                              {a.summary}
                            </div>
                          </div>

                          <CIcon icon={cilArrowRight} size="sm"
                            style={{ color: 'var(--cui-secondary-color)', flexShrink: 0, marginTop: 2 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tickets similaires résolus */}
                {ticket.suggestions.similarTickets?.length > 0 && (
                  <div>
                    <div className="text-muted small text-uppercase fw-semibold mb-3"
                      style={{ letterSpacing: '0.06em' }}>
                      Tickets similaires résolus
                    </div>
                    <div className="d-flex flex-column gap-2">
                      {ticket.suggestions.similarTickets.map((st) => (
                        <div
                          key={st.id}
                          onClick={() => navigate(`/tickets/${st.id}`)}
                          style={{
                            padding: '14px 16px',
                            borderRadius: 10,
                            border: '1px solid var(--cui-border-color)',
                            background: 'var(--cui-tertiary-bg)',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s, background 0.15s',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#22c55e'
                            e.currentTarget.style.background = 'rgba(34,197,94,0.04)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--cui-border-color)'
                            e.currentTarget.style.background = 'var(--cui-tertiary-bg)'
                          }}
                        >
                          {/* Icône ticket résolu */}
                          <div style={{
                            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                            background: 'rgba(34,197,94,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <CIcon icon={cilCheckCircle} style={{ color: '#22c55e' }} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="fw-semibold small mb-1">
                              #{st.id} — {st.title}
                            </div>

                            {/* Note de résolution si disponible */}
                            {st.last_internal_note && (
                              <div className="small mb-1" style={{
                                color: 'var(--cui-body-color)',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}>
                                <span className="text-muted">Solution : </span>
                                {st.last_internal_note}
                              </div>
                            )}

                            <div className="text-muted small">
                              Résolu par {st.resolved_by_name || '—'}{' '}
                              {st.resolved_at
                                ? `le ${new Date(st.resolved_at).toLocaleDateString('fr-FR')}`
                                : ''}
                            </div>
                          </div>

                          <CIcon icon={cilArrowRight} size="sm"
                            style={{ color: 'var(--cui-secondary-color)', flexShrink: 0, marginTop: 2 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </CCardBody>
            </CCard>
          )}

          {/* ── Fil de discussion ── */}
          <CCard className="mb-4">
            <CCardHeader><strong>{t('ticket_detail.thread_title')}</strong></CCardHeader>
            <CCardBody>
              {(!ticket.comments || ticket.comments.length === 0) && (
                <p className="text-muted small">{t('ticket_detail.no_comments')}</p>
              )}
              <CListGroup className="mb-4">
                {ticket.comments?.map((c) => (
                  <CListGroupItem key={c.id} color={c.isInternal ? 'warning' : ''}>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <strong>{c.author}</strong>
                        {c.sentiment && c.sentiment !== 'neutre' && (
                          <CBadge color={getSentimentColor(c.sentiment)} className="ms-2" style={{ fontSize: 10 }}>
                            {getEmotionIcon(c.sentiment)} {formatSentiment(c.sentiment)}
                          </CBadge>
                        )}
                      </div>
                      <small className="text-muted">
                        {new Date(c.createdAt).toLocaleString(
                          t('common.locale', { defaultValue: 'fr-FR' })
                        )}
                      </small>
                    </div>
                    {c.isInternal && (
                      <CBadge color="warning" className="mb-1">
                        {t('ticket_detail.internal_note_badge')}
                      </CBadge>
                    )}
                    <p className="mb-0 mt-1">{c.message}</p>
                  </CListGroupItem>
                ))}
              </CListGroup>

              {canComment && (
                <>
                  <CFormTextarea
                    rows={3}
                    placeholder={t('ticket_detail.msg_placeholder')}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  {(role === 'Technicien' || role === 'Admin') && (
                    <CFormCheck
                      className="mt-2"
                      label={t('ticket_detail.internal_checkbox')}
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                  )}
                  <CButton color="primary" className="mt-2"
                    onClick={handleComment}
                    disabled={commentSaving || !comment.trim()}>
                    {commentSaving ? <CSpinner size="sm" /> : t('ticket_detail.btn_send')}
                  </CButton>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        {/* ── Historique ── */}
        <CCol md={4}>
          <CCard>
            <CCardHeader><strong>{t('ticket_detail.history_title')}</strong></CCardHeader>
            <CCardBody style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {(!ticket.history || ticket.history.length === 0) && (
                <p className="text-muted small">{t('ticket_detail.no_history')}</p>
              )}
              {ticket.history?.map((h) => (
                <div key={h.id} className="mb-3 pb-2 border-bottom">
                  <small className="text-muted d-block">
                    {new Date(h.createdAt).toLocaleString(
                      t('common.locale', { defaultValue: 'fr-FR' })
                    )}
                  </small>
                  <div className="fw-semibold small">{h.actor}</div>
                  <div className="text-muted small">{translateAction(h.action)}</div>
                  {h.oldValue && h.newValue && (
                    <div className="small mt-1">
                      <span className="text-danger">{translateTicketStatus(h.oldValue)}</span>
                      {' → '}
                      <span className="text-success">{translateTicketStatus(h.newValue)}</span>
                    </div>
                  )}
                </div>
              ))}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* ── Modal Recommandation IA ── */}
      <CModal visible={recommendationModal} onClose={() => setRecommendationModal(false)} size="lg">
        <CModalHeader>
          <CModalTitle>{t('recommendations.title')}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="text-muted small mb-3">{t('recommendations.subtitle')}</p>
          
          {/* Formule de calcul */}
          <div className="p-3 rounded mb-3" style={{ background: 'var(--cui-tertiary-bg)', border: '1px solid var(--cui-border-color)' }}>
            <div className="small fw-semibold mb-2">Formule de calcul du score :</div>
            <div className="small" style={{ fontFamily: 'monospace', fontSize: 11 }}>
              Score = (Disponibilité × 0.50) + (Compétences × 0.25) + (Résolution × 0.15) + (Vitesse × 0.10)
            </div>
            <div className="small text-muted mt-2" style={{ fontSize: 10 }}>
              <strong>Disponibilité (50%)</strong> : 0 ticket = 100 pts, 1 = 90, 2 = 80, 3 = 60, 4 = 40, 5 = 20, 6+ = 0<br/>
              <strong>Compétences catégorie (25%)</strong> : taux de résolution dans la catégorie + bonus expérience<br/>
              <strong>Taux de résolution (15%)</strong> : tickets résolus / tickets totaux (3 derniers mois)<br/>
              <strong>Vitesse (10%)</strong> : {'< 4h'} = 100 pts, 4-24h = 70-100, 24-72h = 40-70, {'> 72h'} = 0-40
            </div>
          </div>

          {!recommendations ? (
            <div className="text-center p-4">
              <CSpinner />
              <p className="mt-2 text-muted">{t('recommendations.loading')}</p>
            </div>
          ) : !recommendations.recommended ? (
            <CAlert color="warning">{t('recommendations.no_technicians')}</CAlert>
          ) : (
            <div className="d-flex flex-column gap-3">
              {recommendations.top3.map((tech, idx) => (
                <div key={tech.id}
                  className="p-3 rounded"
                  style={{
                    border: idx === 0 ? '2px solid #2563eb' : '1px solid var(--cui-border-color)',
                    background: idx === 0 ? 'rgba(37,99,235,0.04)' : 'var(--cui-tertiary-bg)',
                  }}>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <strong className="fs-5">
                        {tech.username}
                        {idx === 0 && (
                          <CBadge color="primary" className="ms-2">
                            {t('recommendations.recommended_label')}
                          </CBadge>
                        )}
                      </strong>
                      <div className="text-muted small mt-1">
                        {tech.stats?.resolved_tickets || 0} {t('recommendations.resolved')} •
                        {tech.stats?.active_tickets || 0} {t('recommendations.active_tickets')}
                        {tech.stats?.avg_resolution_hours && (
                          <> • {Math.round(tech.stats.avg_resolution_hours)} {t('recommendations.avg_hours')}</>
                        )}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="fw-bold fs-4" style={{ color: idx === 0 ? '#2563eb' : 'inherit' }}>
                        {tech.score}/100
                      </div>
                      <div className="text-muted small">{t('recommendations.score')}</div>
                    </div>
                  </div>

                  {/* Données réelles de la plateforme */}
                  <div className="mt-2 p-2 rounded" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--cui-border-color)' }}>
                    <div className="small text-muted mb-1" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Données réelles de la plateforme
                    </div>
                    <div className="row g-2 small">
                      <div className="col-6">
                        <span className="text-muted">Tickets actifs:</span>
                        <span className="fw-semibold ms-1">{tech.active_tickets}</span>
                      </div>
                      <div className="col-6">
                        <span className="text-muted">Tickets résolus:</span>
                        <span className="fw-semibold ms-1">{tech.stats?.resolved_tickets || 0}</span>
                      </div>
                      {tech.stats?.avg_resolution_hours && (
                        <div className="col-12">
                          <span className="text-muted">Vitesse moyenne:</span>
                          <span className="fw-semibold ms-1">{Math.round(tech.stats.avg_resolution_hours)}h</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <CRow className="g-2 small">
                    <CCol md={3}>
                      <div className="p-2 rounded" style={{ background: 'var(--cui-tertiary-bg)' }}>
                        <div className="text-muted">{t('recommendations.category_match')}</div>
                        <div className="fw-semibold">{tech.details?.categoryScore || 0}/100</div>
                      </div>
                    </CCol>
                    <CCol md={3}>
                      <div className="p-2 rounded" style={{ background: 'var(--cui-tertiary-bg)' }}>
                        <div className="text-muted">{t('recommendations.skill_rate')}</div>
                        <div className="fw-semibold">{tech.details?.skillScore || 0}/100</div>
                      </div>
                    </CCol>
                    <CCol md={3}>
                      <div className="p-2 rounded" style={{ background: 'var(--cui-tertiary-bg)' }}>
                        <div className="text-muted">{t('recommendations.speed')}</div>
                        <div className="fw-semibold">{tech.details?.speedScore || 0}/100</div>
                      </div>
                    </CCol>
                    <CCol md={3}>
                      <div className="p-2 rounded" style={{ background: 'var(--cui-tertiary-bg)' }}>
                        <div className="text-muted">{t('recommendations.workload')}</div>
                        <div className="fw-semibold">{tech.details?.workloadScore || 0}/100</div>
                      </div>
                    </CCol>
                  </CRow>

                  {idx === 0 && (
                    <CButton color="primary" size="sm" className="mt-3"
                      onClick={() => useRecommendation(tech.id)}>
                      {t('recommendations.btn_use_recommendation')}
                    </CButton>
                  )}
                </div>
              ))}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setRecommendationModal(false)}>
            {t('recommendations.btn_select')}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ── Modal Assignation (Admin) ── */}
      <CModal visible={assignModal} onClose={() => setAssignModal(false)}>
        <CModalHeader>
          <CModalTitle>{t('ticket_detail.modal_assign_title')}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="text-muted small mb-3">{t('ticket_detail.modal_assign_desc')}</p>
          <CFormSelect value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)}>
            <option value="">{t('ticket_detail.select_tech')}</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
                {tech.active_tickets > 0
                  ? ` ${t('ticket_detail.remote_session.tech_active_tickets', { count: tech.active_tickets })}`
                  : ''}
              </option>
            ))}
          </CFormSelect>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleAssign} disabled={!selectedTech}>
            {t('ticket_detail.btn_confirm')}
          </CButton>
          <CButton color="secondary" onClick={() => setAssignModal(false)}>
            {t('ticket_detail.btn_cancel')}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ── Modal Transfert (Technicien) ── */}
      <CModal visible={transferModal} onClose={() => setTransferModal(false)}>
        <CModalHeader>
          <CModalTitle>{t('ticket_detail.modal_transfer_title')}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CFormSelect value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)}>
            <option value="">{t('ticket_detail.select_tech')}</option>
            {technicians
              .filter((tech) => tech.id !== userId)
              .map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.name}
                  {tech.active_tickets > 0
                    ? ` ${t('ticket_detail.remote_session.tech_active_tickets', { count: tech.active_tickets })}`
                    : ''}
                </option>
              ))}
          </CFormSelect>
        </CModalBody>
        <CModalFooter>
          <CButton color="info" onClick={handleTransfer} disabled={!selectedTech}>
            {t('ticket_detail.btn_transfer_confirm')}
          </CButton>
          <CButton color="secondary" onClick={() => setTransferModal(false)}>
            {t('ticket_detail.btn_cancel')}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ── Modal Session à distance (Technicien assigné) ── */}
      <CModal visible={remoteModal} onClose={() => setRemoteModal(false)}>
        <CModalHeader>
          <CModalTitle>{t('ticket_detail.remote_session.modal_title')}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="text-muted small mb-3">
            {t('ticket_detail.remote_session.modal_desc')}
          </p>

          <div className="mb-3">
            <label className="form-label">{t('ticket_detail.remote_session.tool_label')}</label>
            <CFormSelect value={sessionTool} onChange={(e) => setSessionTool(e.target.value)}>
              <option value="AnyDesk">AnyDesk</option>
              <option value="TeamViewer">TeamViewer</option>
              <option value="RustDesk">RustDesk</option>
              <option value="Autre">{t('ticket_detail.remote_session.tool_other')}</option>
            </CFormSelect>
          </div>

          <div className="mb-3">
            <label className="form-label">
              {t('ticket_detail.remote_session.session_id_label')}{' '}
              <span className="text-muted small">{t('ticket_detail.remote_session.session_id_hint')}</span>
            </label>
            <CFormInput
              placeholder={t('ticket_detail.remote_session.session_id_placeholder')}
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            />
          </div>

          <div className="mb-2">
            <label className="form-label">
              {t('ticket_detail.remote_session.url_label')}{' '}
              <span className="text-muted small">{t('ticket_detail.remote_session.url_hint')}</span>
            </label>
            <CFormInput
              placeholder={t('ticket_detail.remote_session.url_placeholder')}
              value={sessionUrl}
              onChange={(e) => setSessionUrl(e.target.value)}
            />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton
            color="info"
            onClick={handleStartRemoteSession}
            disabled={sessionSaving || (!sessionId.trim() && !sessionUrl.trim())}
          >
            {sessionSaving ? t('ticket_detail.remote_session.sending') : t('ticket_detail.remote_session.notify_start')}
          </CButton>
          <CButton color="secondary" onClick={() => setRemoteModal(false)}>
            {t('ticket_detail.btn_cancel')}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default TicketDetail