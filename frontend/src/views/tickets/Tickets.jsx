// src/views/tickets/Tickets.jsx
import React, { useEffect, useMemo, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { getTickets } from '../../services/ticketService'

// ── Couleurs badges statut ──────────────────────────────────────
const STATUS_COLORS = {
  'Nouveau':    'secondary',
  'Assigné':    'info',
  'En cours':   'primary',
  'En attente': 'warning',
  'Résolu':     'success',
  'Clôturé':    'dark',
  'Rouvert':    'danger',
}

const PRIORITY_COLORS = {
  'Haute':   'danger',
  'Moyenne': 'warning',
  'Basse':   'success',
}

// Tous les statuts du cycle de vie complet
const ALL_STATUSES = ['Nouveau', 'Assigné', 'En cours', 'En attente', 'Résolu', 'Clôturé', 'Rouvert']

const Tickets = () => {
  const navigate = useNavigate()
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role  // 'Admin' | 'Technicien' | 'Agent'

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Tous')
  const [priorityFilter, setPriorityFilter] = useState('Tous')

  useEffect(() => {
    getTickets()
      .then(setTickets)
      .catch(() => setError('Erreur lors du chargement des tickets.'))
      .finally(() => setLoading(false))
  }, [])

  const filteredTickets = useMemo(() => {
    const q = query.toLowerCase()
    return tickets.filter((t) => {
      const matchesQuery = [t.id, t.title, t.category, t.assignedTo, t.createdBy]
        .join(' ')
        .toLowerCase()
        .includes(q)
      const matchesStatus   = statusFilter   === 'Tous' || t.status   === statusFilter
      const matchesPriority = priorityFilter === 'Tous' || t.priority === priorityFilter
      return matchesQuery && matchesStatus && matchesPriority
    })
  }, [tickets, query, statusFilter, priorityFilter])

  // Statistiques rapides pour la barre de résumé
  const stats = useMemo(() => ({
    total:      tickets.length,
    nonAssigne: tickets.filter((t) => t.status === 'Nouveau').length,
    enCours:    tickets.filter((t) => t.status === 'En cours').length,
    resolus:    tickets.filter((t) => t.status === 'Résolu').length,
  }), [tickets])

  return (
    <>
      {/* ── En-tête ── */}
      <CRow className="mb-3 align-items-center">
        <CCol>
          <h3 className="mb-0">Tickets</h3>
          <small className="text-muted">
            {role === 'Admin'      && 'Vue globale — tous les tickets'}
            {role === 'Technicien' && 'Vos tickets assignés'}
            {role === 'Agent'      && 'Vos demandes'}
          </small>
        </CCol>
        {/* Seul l'agent peut créer un ticket */}
        {role === 'Agent' && (
          <CCol xs="auto">
            <CButton color="primary" onClick={() => navigate('/tickets/new')}>
              + Nouveau ticket
            </CButton>
          </CCol>
        )}
      </CRow>

      {/* ── Barre de stats rapides (Admin et Technicien) ── */}
      {(role === 'Admin' || role === 'Technicien') && (
        <CRow className="mb-4 g-3">
          {[
            { label: 'Total',        value: stats.total,      color: 'primary' },
            { label: 'Non assignés', value: stats.nonAssigne, color: 'secondary' },
            { label: 'En cours',     value: stats.enCours,    color: 'info' },
            { label: 'Résolus',      value: stats.resolus,    color: 'success' },
          ].map((s) => (
            <CCol xs={6} md={3} key={s.label}>
              <CCard className="text-center border-0 shadow-sm">
                <CCardBody className="py-3">
                  <div className={`fs-2 fw-bold text-${s.color}`}>{s.value}</div>
                  <div className="text-muted small">{s.label}</div>
                </CCardBody>
              </CCard>
            </CCol>
          ))}
        </CRow>
      )}

      {/* ── Filtres ── */}
      <CRow className="mb-3 g-2">
        <CCol md={5}>
          <CInputGroup>
            <CInputGroupText>🔍</CInputGroupText>
            <input
              type="text"
              className="form-control"
              placeholder="Rechercher par ID, titre, catégorie..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </CInputGroup>
        </CCol>
        <CCol md={3}>
          <CFormSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="Tous">Tous les statuts</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={3}>
          <CFormSelect value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="Tous">Toutes les priorités</option>
            <option value="Haute">Haute</option>
            <option value="Moyenne">Moyenne</option>
            <option value="Basse">Basse</option>
          </CFormSelect>
        </CCol>
        {(query || statusFilter !== 'Tous' || priorityFilter !== 'Tous') && (
          <CCol md="auto">
            <CButton color="outline-secondary" onClick={() => {
              setQuery(''); setStatusFilter('Tous'); setPriorityFilter('Tous')
            }}>
              Réinitialiser
            </CButton>
          </CCol>
        )}
      </CRow>

      {/* ── Tableau ── */}
      <CRow>
        <CCol>
          <CCard>
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <strong>Liste des tickets</strong>
              <span className="text-muted small">
                {filteredTickets.length} résultat{filteredTickets.length !== 1 ? 's' : ''}
              </span>
            </CCardHeader>
            <CCardBody className="p-0">
              {loading ? (
                <div className="text-center p-4"><CSpinner /></div>
              ) : error ? (
                <div className="text-danger p-3">{error}</div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center text-muted p-4">
                  {tickets.length === 0
                    ? (role === 'Agent'
                        ? 'Vous n\'avez pas encore créé de ticket.'
                        : 'Aucun ticket pour le moment.')
                    : 'Aucun ticket ne correspond à votre recherche.'}
                </div>
              ) : (
                <CTable hover responsive className="mb-0">
                  <CTableHead color="light">
                    <CTableRow>
                      <CTableHeaderCell>#</CTableHeaderCell>
                      <CTableHeaderCell>Titre</CTableHeaderCell>
                      <CTableHeaderCell>Statut</CTableHeaderCell>
                      <CTableHeaderCell>Priorité</CTableHeaderCell>
                      <CTableHeaderCell>Catégorie</CTableHeaderCell>
                      {/* Colonnes conditionnelles selon le rôle */}
                      {role !== 'Agent' && (
                        <CTableHeaderCell>Créé par</CTableHeaderCell>
                      )}
                      {role !== 'Technicien' && (
                        <CTableHeaderCell>Assigné à</CTableHeaderCell>
                      )}
                      <CTableHeaderCell>Créé le</CTableHeaderCell>
                      <CTableHeaderCell></CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {filteredTickets.map((ticket) => (
                      <CTableRow
                        key={ticket.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                      >
                        <CTableDataCell className="text-muted small">
                          #{ticket.id}
                        </CTableDataCell>
                        <CTableDataCell>
                          <span className="fw-semibold">{ticket.title}</span>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={STATUS_COLORS[ticket.status] || 'secondary'}>
                            {ticket.status}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={PRIORITY_COLORS[ticket.priority] || 'secondary'}>
                            {ticket.priority}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          {ticket.category || <span className="text-muted">—</span>}
                        </CTableDataCell>
                        {role !== 'Agent' && (
                          <CTableDataCell>{ticket.createdBy || '—'}</CTableDataCell>
                        )}
                        {role !== 'Technicien' && (
                          <CTableDataCell>
                            {ticket.assignedTo || (
                              <span className="text-muted fst-italic">Non assigné</span>
                            )}
                          </CTableDataCell>
                        )}
                        <CTableDataCell className="text-muted small">
                          {ticket.createdAt}
                        </CTableDataCell>
                        <CTableDataCell onClick={(e) => e.stopPropagation()}>
                          <CButton
                            color="outline-primary"
                            size="sm"
                            onClick={() => navigate(`/tickets/${ticket.id}`)}
                          >
                            Voir
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default Tickets