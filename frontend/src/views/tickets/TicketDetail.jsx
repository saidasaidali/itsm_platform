// frontend/src/views/tickets/TicketDetail.jsx
import React, { useEffect, useState, useContext, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader,
  CCol, CFormCheck, CFormSelect, CFormTextarea, CListGroup,
  CListGroupItem, CModal, CModalBody, CModalFooter, CModalHeader,
  CModalTitle, CRow, CSpinner, CToast, CToastBody, CToaster, CToastHeader,
} from '@coreui/react'
import {
  getTicketById, updateTicketStatus, assignTicket,
  transferTicket, addComment,
} from '../../services/ticketService'
import { getUsers } from '../../services/userService'

const STATUS_COLORS = {
  'Nouveau': 'secondary', 'Assigné': 'info', 'En cours': 'primary',
  'En attente': 'warning', 'Résolu': 'success', 'Clôturé': 'dark', 'Rouvert': 'danger',
}

const ACTIONS_FR = {
  created: 'Ticket créé',
  auto_assigned: 'Assignation automatique',
  manual_assigned: 'Assignation manuelle',
  status_change: 'Changement de statut',
  comment_added: 'Commentaire ajouté',
  internal_note: 'Note interne ajoutée',
  transferred: 'Ticket transféré',
}

const TicketDetail = () => {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useContext(AuthContext)
  const role   = currentUser?.role
  const userId = currentUser?.id
  const toaster = useRef()

  const [ticket, setTicket]               = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [toast, addToast]                 = useState(0)
  const [comment, setComment]             = useState('')
  const [isInternal, setIsInternal]       = useState(false)
  const [commentSaving, setCommentSaving] = useState(false)
  const [technicians, setTechnicians]     = useState([])
  const [selectedTech, setSelectedTech]   = useState('')
  const [assignModal, setAssignModal]     = useState(false)
  const [transferModal, setTransferModal] = useState(false)

  const showToast = (message, color = 'danger') => {
    addToast(
      <CToast color={color} autohide delay={4000}>
        <CToastHeader closeButton><strong className="me-auto">Info</strong></CToastHeader>
        <CToastBody className={color === 'danger' ? 'text-white' : ''}>{message}</CToastBody>
      </CToast>
    )
  }

  const fetchTicket = async () => {
    try {
      const t = await getTicketById(ticketId)
      setTicket(t)
    } catch {
      setError('Erreur lors du chargement du ticket.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTicket() }, [ticketId])

  useEffect(() => {
    if (role === 'Admin' || role === 'Technicien') {
      getUsers()
        .then((users) => setTechnicians(users.filter((u) => u.role === 'Technicien')))
        .catch(console.error)
    }
  }, [role])

  const handleStatusChange = async (newStatus) => {
    try {
      await updateTicketStatus(ticketId, newStatus)
      showToast(`Statut mis à jour : ${newStatus}`, 'success')
      fetchTicket()
    } catch (e) {
      showToast(e.message || 'Erreur lors du changement de statut.')
    }
  }

  const handleAssign = async () => {
    try {
      await assignTicket(ticketId, selectedTech)
      showToast('Ticket assigné avec succès.', 'success')
      setAssignModal(false)
      fetchTicket()
    } catch (e) {
      showToast(e.message || 'Erreur.')
    }
  }

  const handleTransfer = async () => {
    try {
      await transferTicket(ticketId, selectedTech)
      showToast('Ticket transféré avec succès.', 'success')
      setTransferModal(false)
      fetchTicket()
    } catch (e) {
      showToast(e.message || 'Erreur.')
    }
  }

  const handleComment = async () => {
    if (!comment.trim()) return
    setCommentSaving(true)
    try {
      await addComment(ticketId, comment, isInternal)
      setComment('')
      setIsInternal(false)
      fetchTicket()
    } catch (e) {
      showToast(e.message || 'Erreur.')
    } finally {
      setCommentSaving(false)
    }
  }

  if (loading) return <div className="text-center p-5"><CSpinner /></div>
  if (error)   return <CAlert color="danger">{error}</CAlert>
  if (!ticket) return <CAlert color="warning">Ticket introuvable.</CAlert>

  // ── Permissions ──────────────────────────────────────────────────────────
  // Seul le technicien ASSIGNÉ à CE ticket peut changer le statut
  const isAssignedTech = role === 'Technicien' && ticket.assignedToId === userId
  const canChangeStatus = isAssignedTech  // Admin et Agent ne changent PAS le statut
  const canComment = role === 'Admin' || role === 'Technicien' ||
    (role === 'Agent' && ticket.createdById === userId)

  return (
    <>
      <CToaster ref={toaster} push={toast} placement="top-end" />
      <CRow>
        {/* ── Colonne principale ─────────────────────────────────────────── */}
        <CCol md={8}>

          {/* Infos ticket */}
          <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <div>
                <strong>Ticket #{ticket.id}</strong>
                <span className="ms-2 text-muted">{ticket.title}</span>
              </div>
              <CBadge color={STATUS_COLORS[ticket.status] || 'secondary'} className="fs-6 px-3 py-2">
                {ticket.status}
              </CBadge>
            </CCardHeader>
            <CCardBody>
              <CRow className="mb-3">
                <CCol md={6}>
                  <p><strong>Priorité :</strong> {ticket.priority}</p>
                  <p><strong>Catégorie :</strong> {ticket.category || '—'}</p>
                  <p><strong>Créé par :</strong> {ticket.createdBy}</p>
                  <p><strong>Créé le :</strong> {ticket.createdAt}</p>
                </CCol>
                <CCol md={6}>
                  <p>
                    <strong>Assigné à :</strong>{' '}
                    {ticket.assignedTo || <em className="text-muted">Non assigné</em>}
                  </p>
                  {ticket.dueDate && (
                    <p><strong>Échéance SLA :</strong> <span className="text-danger fw-semibold">{ticket.dueDate}</span></p>
                  )}
                  {ticket.resolvedAt && (
                    <p><strong>Résolu le :</strong> <span className="text-success fw-semibold">{ticket.resolvedAt}</span></p>
                  )}
                </CCol>
              </CRow>

              <div className="mb-4">
                <strong>Description :</strong>
                <p className="mt-1">{ticket.description}</p>
              </div>

              {/* ── Actions Technicien assigné ── */}
              {isAssignedTech && ticket.status === 'Assigné' && (
                <div className="p-3 rounded mb-3"
                  style={{ background: 'rgba(41,128,185,0.08)', border: '1px solid rgba(41,128,185,0.25)' }}>
                  <p className="text-muted small mb-2">Ce ticket vous est assigné et attend votre prise en charge.</p>
                  <CButton color="primary" onClick={() => handleStatusChange('En cours')}>
                    ▶ Prendre en charge
                  </CButton>
                </div>
              )}

              {isAssignedTech && ticket.status === 'En cours' && (
                <div className="p-3 rounded mb-3"
                  style={{ background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.25)' }}>
                  <p className="text-muted small mb-2">Ticket en cours de traitement.</p>
                  <div className="d-flex gap-2 flex-wrap">
                    <CButton color="success" onClick={() => handleStatusChange('Résolu')}>
                      ✓ Marquer comme résolu
                    </CButton>
                    <CButton color="warning" variant="outline" onClick={() => handleStatusChange('En attente')}>
                      ⏸ Mettre en attente
                    </CButton>
                  </div>
                </div>
              )}

              {isAssignedTech && ticket.status === 'En attente' && (
                <div className="p-3 rounded mb-3"
                  style={{ background: 'rgba(243,156,18,0.08)', border: '1px solid rgba(243,156,18,0.25)' }}>
                  <p className="text-muted small mb-2">En attente d'informations complémentaires.</p>
                  <CButton color="warning" onClick={() => handleStatusChange('En cours')}>
                    ↩ Reprendre le traitement
                  </CButton>
                </div>
              )}

              {/* Transfert — technicien assigné seulement */}
              {isAssignedTech && !['Résolu', 'Clôturé'].includes(ticket.status) && (
                <div className="mb-3">
                  <CButton color="outline-info" size="sm"
                    onClick={() => { setSelectedTech(''); setTransferModal(true) }}>
                    ↪ Transférer à un autre technicien
                  </CButton>
                </div>
              )}

              {/* ── Actions Admin : assignation manuelle seulement ── */}
              {role === 'Admin' && (
                <div className="mt-2 d-flex gap-2 flex-wrap">
                  <CButton color="warning" size="sm"
                    onClick={() => { setSelectedTech(''); setAssignModal(true) }}>
                    👤 Assigner à un technicien
                  </CButton>
                </div>
              )}

              {/* ── Message lecture seule pour Agent ── */}
              {role === 'Agent' && (
                <CAlert color="light" className="mt-3 text-muted small border">
                  Le traitement de ce ticket est géré par l'équipe technique.
                </CAlert>
              )}
            </CCardBody>
          </CCard>

          {/* ── Fil de discussion ── */}
          <CCard className="mb-4">
            <CCardHeader><strong>Fil de discussion</strong></CCardHeader>
            <CCardBody>
              {(!ticket.comments || ticket.comments.length === 0) && (
                <p className="text-muted small">Aucun commentaire pour le moment.</p>
              )}
              <CListGroup className="mb-4">
                {ticket.comments?.map((c) => (
                  <CListGroupItem key={c.id} color={c.isInternal ? 'warning' : ''}>
                    <div className="d-flex justify-content-between">
                      <strong>{c.author}</strong>
                      <small className="text-muted">{new Date(c.createdAt).toLocaleString('fr-FR')}</small>
                    </div>
                    {c.isInternal && (
                      <CBadge color="warning" className="mb-1">🔒 Note interne</CBadge>
                    )}
                    <p className="mb-0 mt-1">{c.message}</p>
                  </CListGroupItem>
                ))}
              </CListGroup>

              {canComment && (
                <>
                  <CFormTextarea
                    rows={3}
                    placeholder="Votre message..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  {(role === 'Technicien' || role === 'Admin') && (
                    <CFormCheck
                      className="mt-2"
                      label="🔒 Note interne (visible uniquement par les techniciens et admins)"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                  )}
                  <CButton color="primary" className="mt-2"
                    onClick={handleComment}
                    disabled={commentSaving || !comment.trim()}>
                    {commentSaving ? <CSpinner size="sm" /> : 'Envoyer'}
                  </CButton>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        {/* ── Historique ── */}
        <CCol md={4}>
          <CCard>
            <CCardHeader><strong>Historique des actions</strong></CCardHeader>
            <CCardBody style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {(!ticket.history || ticket.history.length === 0) && (
                <p className="text-muted small">Aucune action enregistrée.</p>
              )}
              {ticket.history?.map((h) => (
                <div key={h.id} className="mb-3 pb-2 border-bottom">
                  <small className="text-muted d-block">
                    {new Date(h.createdAt).toLocaleString('fr-FR')}
                  </small>
                  <div className="fw-semibold small">{h.actor}</div>
                  <div className="text-muted small">{ACTIONS_FR[h.action] || h.action}</div>
                  {h.oldValue && h.newValue && (
                    <div className="small mt-1">
                      <span className="text-danger">{h.oldValue}</span>
                      {' → '}
                      <span className="text-success">{h.newValue}</span>
                    </div>
                  )}
                </div>
              ))}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Modal Assignation (Admin) */}
      <CModal visible={assignModal} onClose={() => setAssignModal(false)}>
        <CModalHeader><CModalTitle>Assigner le ticket</CModalTitle></CModalHeader>
        <CModalBody>
          <p className="text-muted small mb-3">Choisissez le technicien à qui assigner ce ticket.</p>
          <CFormSelect value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)}>
            <option value="">-- Choisir un technicien --</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </CFormSelect>
        </CModalBody>
        <CModalFooter>
          <CButton color="primary" onClick={handleAssign} disabled={!selectedTech}>
            Confirmer
          </CButton>
          <CButton color="secondary" onClick={() => setAssignModal(false)}>Annuler</CButton>
        </CModalFooter>
      </CModal>

      {/* Modal Transfert (Technicien) */}
      <CModal visible={transferModal} onClose={() => setTransferModal(false)}>
        <CModalHeader><CModalTitle>Transférer le ticket</CModalTitle></CModalHeader>
        <CModalBody>
          <CFormSelect value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)}>
            <option value="">-- Choisir un technicien --</option>
            {technicians
              .filter((t) => t.id !== userId)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </CFormSelect>
        </CModalBody>
        <CModalFooter>
          <CButton color="info" onClick={handleTransfer} disabled={!selectedTech}>Transférer</CButton>
          <CButton color="secondary" onClick={() => setTransferModal(false)}>Annuler</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default TicketDetail