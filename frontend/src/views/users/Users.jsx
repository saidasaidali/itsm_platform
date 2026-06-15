// src/views/users/Users.jsx
import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
} from '@coreui/react'
import { getUserStats, getUsers, updateUserStatus, deleteUser } from '../../services/userService'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:   { label: 'Actif',      color: 'success' },
  pending:  { label: 'En attente', color: 'warning' },
  inactive: { label: 'Inactif',    color: 'secondary' },
}

const ROLE_COLOR = {
  Admin:      'danger',
  Technicien: 'info',
  Agent:      'secondary',
}

// ─── Composant ────────────────────────────────────────────────────────────────
const Users = () => {
  const [users, setUsers]       = useState([])
  const [stats, setStats]       = useState({ total: 0, admins: 0, pending: 0, inactive: 0 })
  const [loading, setLoading]   = useState(true)
  const [toasts, setToasts]     = useState([])
  const [confirmModal, setConfirmModal] = useState(null) // { userId, action }
  const navigate = useNavigate()

  // ─── Chargement ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [userList, userStats] = await Promise.all([getUsers(), getUserStats()])
      setUsers(userList)
      setStats(userStats)
    } catch (err) {
      addToast('danger', 'Erreur lors du chargement des utilisateurs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ─── Toasts ────────────────────────────────────────────────────────────────
  const addToast = (color, message) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, color, message }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  // ─── Actions sur le statut ─────────────────────────────────────────────────
  const handleStatusChange = async (userId, newStatus) => {
    try {
      await updateUserStatus(userId, newStatus)
      const labels = { active: 'activé', inactive: 'désactivé', pending: 'mis en attente' }
      addToast('success', `Compte ${labels[newStatus]} avec succès.`)
      await loadData()
    } catch (err) {
      addToast('danger', err.message || 'Erreur lors de la mise à jour du statut.')
    }
  }

  // ─── Suppression ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmModal) return
    try {
      await deleteUser(confirmModal.userId)
      addToast('success', 'Utilisateur supprimé.')
      setConfirmModal(null)
      await loadData()
    } catch (err) {
      addToast('danger', err.message || 'Erreur lors de la suppression.')
      setConfirmModal(null)
    }
  }

  // ─── Boutons d'action par statut ───────────────────────────────────────────
  const renderActions = (user) => (
    <div className="d-flex gap-2 flex-wrap">
      {/* Valider un compte en attente */}
      {user.status === 'pending' && (
        <CButton
          color="success"
          size="sm"
          onClick={() => handleStatusChange(user.id, 'active')}
        >
          ✓ Valider
        </CButton>
      )}

      {/* Désactiver un compte actif */}
      {user.status === 'active' && (
        <CButton
          color="warning"
          size="sm"
          onClick={() => handleStatusChange(user.id, 'inactive')}
        >
          Désactiver
        </CButton>
      )}

      {/* Réactiver un compte inactif */}
      {user.status === 'inactive' && (
        <CButton
          color="info"
          size="sm"
          onClick={() => handleStatusChange(user.id, 'active')}
        >
          Réactiver
        </CButton>
      )}

      {/* Modifier */}
      <CButton
        color="primary"
        variant="outline"
        size="sm"
        onClick={() => navigate(`/users/${user.id}/edit`)}
      >
        Modifier
      </CButton>

      {/* Supprimer */}
      <CButton
        color="danger"
        variant="outline"
        size="sm"
        onClick={() => setConfirmModal({ userId: user.id, username: user.name })}
      >
        Supprimer
      </CButton>
    </div>
  )

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Toasts ─────────────────────────────────────────────────────────── */}
      <CToaster placement="top-end" push={undefined}>
        {toasts.map((t) => (
          <CToast key={t.id} autohide={false} visible color={t.color} className="text-white">
            <CToastHeader closeButton className={`bg-${t.color} text-white`}>
              <strong className="me-auto">Utilisateurs</strong>
            </CToastHeader>
            <CToastBody>{t.message}</CToastBody>
          </CToast>
        ))}
      </CToaster>

      {/* ── Modal confirmation suppression ─────────────────────────────────── */}
      <CModal visible={!!confirmModal} onClose={() => setConfirmModal(null)}>
        <CModalHeader>
          <CModalTitle>Confirmer la suppression</CModalTitle>
        </CModalHeader>
        <CModalBody>
          Voulez-vous vraiment supprimer l'utilisateur{' '}
          <strong>{confirmModal?.username}</strong> ? Cette action est irréversible.
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setConfirmModal(null)}>
            Annuler
          </CButton>
          <CButton color="danger" onClick={handleDelete}>
            Supprimer
          </CButton>
        </CModalFooter>
      </CModal>

      {/* ── Statistiques ───────────────────────────────────────────────────── */}
      <CRow className="g-4 mb-4">
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">Total utilisateurs</div>
            <div className="fs-2 fw-semibold">{stats.total}</div>
            <div className="text-muted small">Tous les comptes</div>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">Administrateurs</div>
            <div className="fs-2 fw-semibold">{stats.admins}</div>
            <div className="text-muted small">Comptes avec privilèges Admin</div>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100 border-warning">
            <div className="text-uppercase text-warning small mb-2">En attente</div>
            <div className="fs-2 fw-semibold text-warning">{stats.pending}</div>
            <div className="text-muted small">Comptes à valider</div>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} xl={3}>
          <CCard className="p-3 h-100">
            <div className="text-uppercase text-secondary small mb-2">Inactifs</div>
            <div className="fs-2 fw-semibold">{stats.inactive}</div>
            <div className="text-muted small">Comptes désactivés</div>
          </CCard>
        </CCol>
      </CRow>

      {/* ── Tableau utilisateurs ────────────────────────────────────────────── */}
      <CRow>
        <CCol>
          <CCard className="mb-4">
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <span>Liste des utilisateurs</span>
              <CButton color="primary" onClick={() => navigate('/users/new')}>
                + Ajouter un utilisateur
              </CButton>
            </CCardHeader>
            <CCardBody>
              {loading ? (
                <div className="text-center py-5">
                  <CSpinner color="primary" />
                  <p className="mt-2 text-muted">Chargement...</p>
                </div>
              ) : users.length === 0 ? (
                <p className="text-center text-muted py-4">Aucun utilisateur trouvé.</p>
              ) : (
                <CTable responsive bordered hover>
                  <CTableHead color="light">
                    <CTableRow>
                      <CTableHeaderCell>ID</CTableHeaderCell>
                      <CTableHeaderCell>Nom d'utilisateur</CTableHeaderCell>
                      <CTableHeaderCell>Email</CTableHeaderCell>
                      <CTableHeaderCell>Rôle</CTableHeaderCell>
                      <CTableHeaderCell>Statut</CTableHeaderCell>
                      <CTableHeaderCell>Actions</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {users.map((user) => {
                      const statusCfg = STATUS_CONFIG[user.status] || STATUS_CONFIG.active
                      return (
                        <CTableRow key={user.id}>
                          <CTableDataCell className="text-muted">{user.id}</CTableDataCell>
                          <CTableDataCell className="fw-semibold">{user.name}</CTableDataCell>
                          <CTableDataCell>{user.email}</CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={ROLE_COLOR[user.role] || 'secondary'}>
                              {user.role}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>
                            <CBadge color={statusCfg.color}>
                              {statusCfg.label}
                            </CBadge>
                          </CTableDataCell>
                          <CTableDataCell>{renderActions(user)}</CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
            <CCardFooter className="text-muted small">
              Gestion des accès et des rôles ITSM
            </CCardFooter>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default Users