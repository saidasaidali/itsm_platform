import React, { useEffect, useMemo, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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

const STATUS_COLORS = {
  Nouveau: 'secondary',
  Assigné: 'info',
  'En cours': 'primary',
  'En attente': 'warning',
  Résolu: 'success',
  Clôturé: 'dark',
  Rouvert: 'danger',
}

const PRIORITY_COLORS = {
  Haute: 'danger',
  Moyenne: 'warning',
  Basse: 'success',
}

const ALL_STATUSES = ['Nouveau', 'Assigné', 'En cours', 'En attente', 'Résolu', 'Clôturé', 'Rouvert']
const PRIORITIES = ['Haute', 'Moyenne', 'Basse']
const ALL = 'Tous'

const Tickets = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [priorityFilter, setPriorityFilter] = useState(ALL)

  useEffect(() => {
    getTickets()
      .then(setTickets)
      .catch(() => setError(t('tickets.list.load_error')))
      .finally(() => setLoading(false))
  }, [t])

  const filteredTickets = useMemo(() => {
    const q = query.toLowerCase()
    return tickets.filter((ticket) => {
      const matchesQuery = [ticket.id, ticket.title, ticket.category, ticket.assignedTo, ticket.createdBy]
        .join(' ')
        .toLowerCase()
        .includes(q)
      const matchesStatus = statusFilter === ALL || ticket.status === statusFilter
      const matchesPriority = priorityFilter === ALL || ticket.priority === priorityFilter
      return matchesQuery && matchesStatus && matchesPriority
    })
  }, [tickets, query, statusFilter, priorityFilter])

  const stats = useMemo(
    () => ({
      total: tickets.length,
      unassigned: tickets.filter((ticket) => ticket.status === 'Nouveau').length,
      inProgress: tickets.filter((ticket) => ticket.status === 'En cours').length,
      resolved: tickets.filter((ticket) => ticket.status === 'Résolu').length,
    }),
    [tickets],
  )

  const translateStatus = (status) => t(`tickets.status.${status}`, { defaultValue: status })
  const translatePriority = (priority) => t(`tickets.priority.${priority}`, { defaultValue: priority })
  const translateCategory = (category) => t(`tickets.category.${category}`, { defaultValue: category })

  return (
    <>
      <CRow className="mb-3 align-items-center">
        <CCol>
          <h3 className="mb-0">{t('tickets.list.title')}</h3>
          <small className="text-muted">{t(`tickets.list.subtitle.${role}`, { defaultValue: '' })}</small>
        </CCol>
        {role === 'Agent' && (
          <CCol xs="auto">
            <CButton color="primary" onClick={() => navigate('/tickets/new')}>
              {t('tickets.list.new_ticket')}
            </CButton>
          </CCol>
        )}
      </CRow>

      {(role === 'Admin' || role === 'Technicien') && (
        <CRow className="mb-4 g-3">
          {[
            { label: t('tickets.stats.total'), value: stats.total, color: 'primary' },
            { label: t('tickets.stats.unassigned'), value: stats.unassigned, color: 'secondary' },
            { label: t('tickets.stats.in_progress'), value: stats.inProgress, color: 'info' },
            { label: t('tickets.stats.resolved'), value: stats.resolved, color: 'success' },
          ].map((stat) => (
            <CCol xs={6} md={3} key={stat.label}>
              <CCard className="text-center border-0 shadow-sm">
                <CCardBody className="py-3">
                  <div className={`fs-2 fw-bold text-${stat.color}`}>{stat.value}</div>
                  <div className="text-muted small">{stat.label}</div>
                </CCardBody>
              </CCard>
            </CCol>
          ))}
        </CRow>
      )}

      <CRow className="mb-3 g-2">
        <CCol md={5}>
          <CInputGroup>
            <CInputGroupText>🔍</CInputGroupText>
            <input
              type="text"
              className="form-control"
              placeholder={t('tickets.list.search_placeholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </CInputGroup>
        </CCol>
        <CCol md={3}>
          <CFormSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value={ALL}>{t('tickets.filters.all_statuses')}</option>
            {ALL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {translateStatus(status)}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={3}>
          <CFormSelect value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value={ALL}>{t('tickets.filters.all_priorities')}</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {translatePriority(priority)}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        {(query || statusFilter !== ALL || priorityFilter !== ALL) && (
          <CCol md="auto">
            <CButton
              color="outline-secondary"
              onClick={() => {
                setQuery('')
                setStatusFilter(ALL)
                setPriorityFilter(ALL)
              }}
            >
              {t('common.reset')}
            </CButton>
          </CCol>
        )}
      </CRow>

      <CRow>
        <CCol>
          <CCard>
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <strong>{t('tickets.list.table_title')}</strong>
              <span className="text-muted small">
                {t('common.results_count', { count: filteredTickets.length })}
              </span>
            </CCardHeader>
            <CCardBody className="p-0">
              {loading ? (
                <div className="text-center p-4">
                  <CSpinner />
                </div>
              ) : error ? (
                <div className="text-danger p-3">{error}</div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center text-muted p-4">
                  {tickets.length === 0
                    ? role === 'Agent'
                      ? t('tickets.list.empty_agent')
                      : t('tickets.list.empty')
                    : t('tickets.list.no_match')}
                </div>
              ) : (
                <CTable hover responsive className="mb-0">
                  <CTableHead color="light">
                    <CTableRow>
                      <CTableHeaderCell>#</CTableHeaderCell>
                      <CTableHeaderCell>{t('tickets.fields.title')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('tickets.fields.status')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('tickets.fields.priority')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('tickets.fields.category')}</CTableHeaderCell>
                      {role !== 'Agent' && <CTableHeaderCell>{t('tickets.fields.created_by')}</CTableHeaderCell>}
                      {role !== 'Technicien' && <CTableHeaderCell>{t('tickets.fields.assigned_to')}</CTableHeaderCell>}
                      <CTableHeaderCell>{t('tickets.fields.created_at')}</CTableHeaderCell>
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
                        <CTableDataCell className="text-muted small">#{ticket.id}</CTableDataCell>
                        <CTableDataCell>
                          <span className="fw-semibold">{ticket.title}</span>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={STATUS_COLORS[ticket.status] || 'secondary'}>
                            {translateStatus(ticket.status)}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={PRIORITY_COLORS[ticket.priority] || 'secondary'}>
                            {translatePriority(ticket.priority)}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          {ticket.category ? translateCategory(ticket.category) : <span className="text-muted">-</span>}
                        </CTableDataCell>
                        {role !== 'Agent' && <CTableDataCell>{ticket.createdBy || '-'}</CTableDataCell>}
                        {role !== 'Technicien' && (
                          <CTableDataCell>
                            {ticket.assignedTo || (
                              <span className="text-muted fst-italic">{t('tickets.common.unassigned')}</span>
                            )}
                          </CTableDataCell>
                        )}
                        <CTableDataCell className="text-muted small">{ticket.createdAt}</CTableDataCell>
                        <CTableDataCell onClick={(event) => event.stopPropagation()}>
                          <CButton
                            color="outline-primary"
                            size="sm"
                            onClick={() => navigate(`/tickets/${ticket.id}`)}
                          >
                            {t('common.view')}
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
