// frontend/src/views/profile/Profile.jsx
import React, { useContext, useState, useRef } from 'react'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CButton, CCard, CCardBody, CCardHeader, CCol, CForm,
  CFormInput, CRow, CToast, CToastBody, CToaster, CToastHeader,
} from '@coreui/react'
import api from '../../services/api'

const ROLE_COLORS = { Admin: '#e74c3c', Technicien: '#2980b9', Agent: '#27ae60' }

const Profile = () => {
  const { currentUser, login } = useContext(AuthContext)
  const toaster = useRef()
  const [toast, addToast] = useState(0)

  const username = currentUser?.username || ''
  const role     = currentUser?.role     || ''
  const initiale = username.charAt(0).toUpperCase()
  const color    = ROLE_COLORS[role] || '#6c757d'

  const [form, setForm] = useState({
    username:        username,
    email:           currentUser?.email || '',
    password:        '',
    confirmPassword: '',
  })
  const [saving, setSaving] = useState(false)

  const showToast = (message, color = 'danger') => {
    addToast(
      <CToast color={color} autohide delay={4000}>
        <CToastHeader closeButton><strong className="me-auto">Profil</strong></CToastHeader>
        <CToastBody className={color === 'danger' ? 'text-white' : ''}>{message}</CToastBody>
      </CToast>
    )
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password && form.password !== form.confirmPassword) {
      showToast('Les mots de passe ne correspondent pas.')
      return
    }
    setSaving(true)
    try {
      const payload = {}
      if (form.username !== username)    payload.username = form.username
      if (form.email !== currentUser?.email) payload.email = form.email
      if (form.password)                 payload.password = form.password

      // Utilise la route /me accessible à tous les rôles
      const data = await api.patch('/api/users/me', payload)

      // Mettre à jour le localStorage pour refléter les changements
      const stored = localStorage.getItem('itsm-auth-user')
      if (stored) {
        const parsed = JSON.parse(stored)
        const updated = { ...parsed, ...data.data }
        localStorage.setItem('itsm-auth-user', JSON.stringify(updated))
      }

      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }))
      showToast('Profil mis à jour avec succès.', 'success')
    } catch (err) {
      showToast(err.message || 'Erreur lors de la mise à jour.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CRow className="justify-content-center">
      <CToaster ref={toaster} push={toast} placement="top-end" />
      <CCol md={7} lg={6}>

        {/* Avatar */}
        <div className="text-center mb-4">
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            backgroundColor: color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '700', fontSize: '36px', margin: '0 auto 12px',
            boxShadow: `0 4px 16px ${color}55`,
          }}>
            {initiale}
          </div>
          <h5 className="mb-0">{username}</h5>
          <span className="badge mt-1" style={{ backgroundColor: color, fontSize: '12px' }}>{role}</span>
        </div>

        {/* Formulaire */}
        <CCard>
          <CCardHeader><strong>Modifier mon profil</strong></CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>
              <div className="mb-3">
                <CFormInput
                  label="Nom d'utilisateur"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="mb-3">
                <CFormInput
                  type="email"
                  label="Email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <hr />
              <p className="text-muted small mb-3">
                Laissez vide si vous ne souhaitez pas changer le mot de passe.
              </p>
              <div className="mb-3">
                <CFormInput
                  type="password"
                  label="Nouveau mot de passe"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
              </div>
              <div className="mb-4">
                <CFormInput
                  type="password"
                  label="Confirmer le mot de passe"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
              </div>
              <CButton type="submit" color="primary" disabled={saving} className="w-100">
                {saving ? 'Enregistrement...' : 'Sauvegarder'}
              </CButton>
            </CForm>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default Profile