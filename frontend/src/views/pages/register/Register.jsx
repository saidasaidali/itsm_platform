// src/views/register/Register.jsx
import React, { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardGroup,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CRow,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser, cilEnvelopeClosed, cilPeople } from '@coreui/icons'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../../auth/AuthProvider'

const getRoles = (t) => [
  { id: 2, label: t('register.role_technician') },
  { id: 3, label: t('register.role_agent') },
]

const Register = () => {
  const { register } = useContext(AuthContext)
  const { t } = useTranslation()
  const ROLES = getRoles(t)
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role_id: '',
  })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!form.username || !form.email || !form.password || !form.confirmPassword || !form.role_id) {
      setError(t('register.error_fields'))
      return
    }

    if (form.password !== form.confirmPassword) {
      setError(t('register.error_passwords'))
      return
    }

    setLoading(true)

    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
        role_id: Number(form.role_id),
      })
      // Pas de redirection automatique — le compte doit être validé par un admin
      setSuccess(true)
    } catch (registerError) {
      setError(registerError.message || t('register.error_generic'))
    } finally {
      setLoading(false)
    }
  }

  // ─── Écran de confirmation après inscription ──────────────────────────────
  if (success) {
    return (
      <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
        <CContainer>
          <CRow className="justify-content-center">
            <CCol md={6}>
              <CCard className="p-4 text-center">
                <CCardBody>
                  <div className="mb-3" style={{ fontSize: '3rem' }}>✅</div>
                  <h2 className="mb-3">{t('register.pending_title')}</h2>
                  <p className="text-body-secondary mb-4">
                    {t('register.pending_desc')}
                  </p>
                  <Link to="/login">
                    <CButton color="primary">{t('register.pending_btn')}</CButton>
                  </Link>
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </CContainer>
      </div>
    )
  }

  // ─── Formulaire d'inscription ─────────────────────────────────────────────
  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={7} xl={6}>
            <CCardGroup>
              <CCard className="p-4">
                <CCardBody>
                  <h1>{t('register.title')}</h1>
                  <p className="text-body-secondary">{t('register.subtitle')}</p>

                  {error && <CAlert color="danger">{error}</CAlert>}

                  <CForm onSubmit={handleSubmit}>
                    {/* Nom d'utilisateur */}
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        placeholder={t('register.username_placeholder')}
                        name="username"
                        value={form.username}
                        onChange={handleChange}
                        autoComplete="username"
                        required
                      />
                    </CInputGroup>

                    {/* Email */}
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilEnvelopeClosed} />
                      </CInputGroupText>
                      <CFormInput
                        type="email"
                        placeholder={t('register.email_placeholder')}
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        autoComplete="email"
                        required
                      />
                    </CInputGroup>

                    {/* Rôle */}
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilPeople} />
                      </CInputGroupText>
                      <CFormSelect
                        name="role_id"
                        value={form.role_id}
                        onChange={handleChange}
                        required
                      >
                        <option value="">{t('register.role_placeholder')}</option>
                        {ROLES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </CFormSelect>
                    </CInputGroup>

                    {/* Mot de passe */}
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type="password"
                        placeholder={t('register.password_placeholder')}
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                        required
                      />
                    </CInputGroup>

                    {/* Confirmer mot de passe */}
                    <CInputGroup className="mb-4">
                      <CInputGroupText>
                        <CIcon icon={cilLockLocked} />
                      </CInputGroupText>
                      <CFormInput
                        type="password"
                        placeholder={t('register.confirm_placeholder')}
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        autoComplete="new-password"
                        required
                      />
                    </CInputGroup>

                    <div className="d-grid">
                      <CButton type="submit" color="success" disabled={loading}>
                        {loading ? t('register.loading') : t('register.submit')}
                      </CButton>
                    </div>
                  </CForm>

                  <div className="text-center mt-3">
                    <small>
                      {t('register.already_account')}{' '}
                      <Link to="/login" className="text-primary">
                        {t('register.back_login')}
                      </Link>
                    </small>
                  </div>
                </CCardBody>
              </CCard>

            
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Register