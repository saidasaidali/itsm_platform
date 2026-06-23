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
import {
  getTicketById, updateTicketStatus, assignTicket,
  transferTicket, addComment, startRemoteSession, endRemoteSession,
} from '../../services/ticketService'
import { getActiveTechnicians } from '../../services/userService'
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
      fetchTicket()
    } catch (e) {
      showToast(e.message || t('ticket_detail.error'))
    }
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
    !['Résolu', 'Clôturé'].includes(ticket.status)

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
            </CCardBody>
          </CCard>

          {/* ── Suggestions automatiques ── */}
          {hasSuggestions && (
            <CCard className="mb-4">
              <CCardHeader>
                <strong>{t('ticket_detail.suggestions_title')}</strong>
              </CCardHeader>
              <CCardBody>
                {ticket.suggestions.articles?.length > 0 && (
                  <div className="mb-3">
                    <h6 className="text-muted small text-uppercase mb-2">
                      {t('ticket_detail.articles_title')}
                    </h6>
                    {ticket.suggestions.articles.map((a) => (
                      <div key={a.id} className="p-2 mb-2 rounded"
                        style={{ background: 'rgba(59,130,246,0.06)', cursor: 'pointer' }}
                        onClick={() => navigate(`/knowledge/${a.id}`)}>
                        <strong className="small">{a.title}</strong>
                        <p className="small text-muted mb-0">{a.summary}</p>
                      </div>
                    ))}
                  </div>
                )}

                {ticket.suggestions.similarTickets?.length > 0 && (
                  <div>
                    <h6 className="text-muted small text-uppercase mb-2">
                      {t('ticket_detail.similar_tickets_title')}
                    </h6>
                    {ticket.suggestions.similarTickets.map((st) => (
                      <div key={st.id} className="p-2 mb-2 rounded"
                        style={{ background: 'rgba(39,174,96,0.06)', cursor: 'pointer' }}
                        onClick={() => navigate(`/tickets/${st.id}`)}>
                        <strong className="small">#{st.id} — {st.title}</strong>
                        {st.last_internal_note && (
                          <p className="small text-muted mb-0 mt-1">
                            {t('ticket_detail.solution')}{' '}
                            {st.last_internal_note.substring(0, 120)}
                            {st.last_internal_note.length > 120 ? '...' : ''}
                          </p>
                        )}
                        <small className="text-muted">
                          {t('ticket_detail.resolved_by', {
                            name: st.resolved_by_name || '—',
                            date: st.resolved_at
                              ? new Date(st.resolved_at).toLocaleDateString(
                                  t('common.locale', { defaultValue: 'fr-FR' })
                                )
                              : '',
                          })}
                        </small>
                      </div>
                    ))}
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
                    <div className="d-flex justify-content-between">
                      <strong>{c.author}</strong>
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