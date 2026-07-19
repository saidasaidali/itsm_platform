// src/views/users/Users.jsx
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import usePageTitle from '../../utils/usePageTitle'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardFooter,
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
  CToast,
  CToastBody,
  CToastHeader,
  CToaster,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch } from '@coreui/icons'
import {
  getUserStats,
  getUsers,
  updateUserStatus,
  deleteUser,
  adminResetPassword,
  getServices,
} from '../../services/userService'
import { translateRole } from '../../utils/translate'

const getStatusConfig = (t) => ({
  active: { label: t('users.status_active'), color: 'success' },
  pending: { label: t('users.status_pending_label'), color: 'warning' },
  inactive: { label: t('users.status_inactive_label'), color: 'secondary' },
})

const ROLE_COLOR = {
  Admin: 'danger',
  Technicien: 'info',
  Agent: 'secondary',
}

const ALL = ''

const Users = () => {
  usePageTitle('Users', 'Manage system users and access')
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({ total: 0, admins: 0, pending: 0, inactive: 0 })
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])
  const [confirmModal, setConfirmModal] = useState(null)
  const [services, setServices] = useState([])
  const [serviceFilter, setServiceFilter] = useState(ALL)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { t } = useTranslation()

  const STATUS_CONFIG = getStatusConfig(t)

  const addToast = useCallback((color, message) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, color, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const loadData = useCallback(
    async (filterService) => {
      setLoading(true)
      try {
        const svc = filterService !== undefined ? filterService : serviceFilter
        const [userList, userStats, servicesList] = await Promise.all([
          getUsers(svc ? { service: svc } : {}),
          getUserStats(),
          getServices(),
        ])
        setUsers(userList)
        setStats(userStats)
        setServices(servicesList)
      } catch (err) {
        addToast('danger', t('users.load_error'))
      } finally {
        setLoading(false)
      }
    },
    [addToast, t],
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleServiceChange = (event) => {
    const value = event.target.value
    setServiceFilter(value)
    loadData(value)
  }

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await updateUserStatus(userId, newStatus)
      if (newStatus === 'active') addToast('success', t('users.status_active_success'))
      else if (newStatus === 'inactive') addToast('success', t('users.status_inactive_success'))
      else if (newStatus === 'pending') addToast('success', t('users.status_pending_success'))
      await loadData()
    } catch (err) {
      addToast('danger', err.message || t('users.status_error'))
    }
  }

  const handleDelete = async () => {
    if (!confirmModal) return
    try {
      await deleteUser(confirmModal.userId)
      addToast('success', t('users.delete_success'))
      setConfirmModal(null)
      await loadData()
    } catch (err) {
      addToast('danger', err.message || t('users.delete_error'))
      setConfirmModal(null)
    }
  }

  const handleResetPassword = async (user) => {
    if (!window.confirm(t('users.reset_confirm', { name: user.name }))) return
    try {
      const result = await adminResetPassword(user.id)
      addToast('success', result.message)
    } catch (err) {
      addToast('danger', err.message || t('users.reset_error'))
    }
  }

  const handleReset = () => {
    setQuery('')
    setServiceFilter(ALL)
    loadData(ALL)
  }

  const filtered = users.filter((user) => {
    const q = query.toLowerCase()
    const matchQuery = [user.name, user.email, user.direction, user.division, user.service]
      .join(' ')
      .toLowerCase()
      .includes(q)
    return matchQuery
  })

  const renderActions = (user) => (
    <div className="d-flex gap-2 flex-wrap">
      {user.status === 'pending' && (
        <CButton color="success" size="sm" onClick={() => handleStatusChange(user.id, 'active')}>
          {t('users.action_validate')}
        </CButton>
      )}

      {user.status === 'active' && (
        <CButton color="warning" size="sm" onClick={() => handleStatusChange(user.id, 'inactive')}>
          {t('users.action_deactivate')}
        </CButton>
      )}

      {user.status === 'inactive' && (
        <CButton color="info" size="sm" onClick={() => handleStatusChange(user.id, 'active')}>
          {t('users.action_reactivate')}
        </CButton>
      )}

      <CButton
        color="primary"
        variant="outline"
        size="sm"
        onClick={() => navigate(`/users/${user.id}/edit`)}
      >
        {t('users.action_edit')}
      </CButton>

      <CButton color="info" variant="outline" size="sm" onClick={() => handleResetPassword(user)}>
        {t('users.action_reset_pwd')}
      </CButton>

      <CButton
        color="danger"
        variant="outline"
        size="sm"
        onClick={() => setConfirmModal({ userId: user.id, username: user.name })}
      >
        {t('users.action_delete')}
      </CButton>
    </div>
  )

  return (
    <>
      <CToaster placement="top-end" push={undefined}>
        {toasts.map((toastItem) => (
          <CToast
            key={toastItem.id}
            autohide={false}
            visible
            color={toastItem.color}
            className="text-white"
          >
            <CToastHeader closeButton className={`bg-${toastItem.color} text-white`}>
              <strong className="me-auto">{t('users.title')}</strong>
            </CToastHeader>
            <CToastBody>{toastItem.message}</CToastBody>
          </CToast>
        ))}
      </CToaster>

      <CModal visible={!!confirmModal} onClose={() => setConfirmModal(null)}>
        <CModalHeader>
          <CModalTitle>{t('users.modal_delete_title')}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {t('users.modal_delete_desc')} <strong>{confirmModal?.username}</strong>
          {t('users.modal_delete_warning')}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setConfirmModal(null)}>
            {t('users.modal_cancel')}
          </CButton>
          <CButton color="danger" onClick={handleDelete}>
            {t('users.action_delete')}
          </CButton>
        </CModalFooter>
      </CModal>

      <CRow className="g-4 mb-4">
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">{t('users.stats_total')}</div>
            <div className="fs-2 fw-semibold">{stats.total}</div>
            <div className="text-muted small">{t('users.stats_total_desc')}</div>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">
              {t('users.stats_admins')}
            </div>
            <div className="fs-2 fw-semibold">{stats.admins}</div>
            <div className="text-muted small">{t('users.stats_admins_desc')}</div>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100 border-warning">
            <div className="text-uppercase text-warning small mb-2">{t('users.stats_pending')}</div>
            <div className="fs-2 fw-semibold text-warning">{stats.pending}</div>
            <div className="text-muted small">{t('users.stats_pending_desc')}</div>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">
              {t('users.stats_inactive')}
            </div>
            <div className="fs-2 fw-semibold">{stats.inactive}</div>
            <div className="text-muted small">{t('users.stats_inactive_desc')}</div>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="mb-3 g-2">
        <CCol md={4}>
          <CInputGroup>
            <CInputGroupText>
              <CIcon icon={cilSearch} />
            </CInputGroupText>
            <input
              className="form-control"
              placeholder={t('users.search_placeholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </CInputGroup>
        </CCol>
        <CCol md={3}>
          <CFormSelect value={serviceFilter} onChange={handleServiceChange}>
            <option value={ALL}>{t('users.filter_all_services')}</option>
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        {(query || serviceFilter !== ALL) && (
          <CCol md="auto">
            <CButton color="outline-secondary" onClick={handleReset}>
              {t('common.reset')}
            </CButton>
          </CCol>
        )}
      </CRow>

      <CRow>
        <CCol>
          <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <span>
                {t('users.list_title')}{' '}
                <span className="text-muted small">({filtered.length})</span>
              </span>
              <div className="d-flex gap-2">
                <CButton
                  color="success"
                  variant="outline"
                  onClick={() => navigate('/users/import')}
                >
                  {t('common.import_excel')}
                </CButton>
                <CButton color="primary" onClick={() => navigate('/users/new')}>
                  {t('users.add_user')}
                </CButton>
              </div>
            </CCardHeader>
            <CCardBody>
              {loading ? (
                <div className="text-center py-5">
                  <CSpinner color="primary" />
                  <p className="mt-2 text-muted">{t('users.loading')}</p>
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted py-4">{t('users.empty')}</p>
              ) : (
                <CTable responsive bordered hover>
                  <CTableHead color="light">
                    <CTableRow>
                      <CTableHeaderCell>{t('users.col_id')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('users.col_username')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('users.col_email')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('users.col_role')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('users.col_direction')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('users.col_division')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('users.col_service')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('users.col_status')}</CTableHeaderCell>
                      <CTableHeaderCell>{t('users.col_actions')}</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {filtered.map((user) => {
                      const statusCfg = STATUS_CONFIG[user.status] || STATUS_CONFIG.active
                      return (
                        <CTableRow key={user.id}>
                          <CTableDataCell className="text-muted">{user.id}</CTableDataCell>
                          <CTableDataCell className="fw-semibold">{user.name}</CTableDataCell>
                          <CTableDataCell>{user.email}</CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={ROLE_COLOR[user.role] || 'secondary'}>
                              {translateRole(user.role)}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            {user.direction || <em className="text-muted">-</em>}
                          </CTableDataCell>
                          <CTableDataCell>
                            {user.division || <em className="text-muted">-</em>}
                          </CTableDataCell>
                          <CTableDataCell>
                            {user.service || <em className="text-muted">-</em>}
                          </CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={statusCfg.color}>{statusCfg.label}</CBadge>
                          </CTableDataCell>
                          <CTableDataCell>{renderActions(user)}</CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
            <CCardFooter className="text-muted small">{t('users.footer')}</CCardFooter>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default Users
