import React, { useContext, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser, cilArrowLeft } from '@coreui/icons'
import { useTranslation } from 'react-i18next'

import { AuthContext } from '../../../auth/AuthProvider'
import usePageTitle from '../../../utils/usePageTitle'
import LanguageToggle from '../../../components/LanguageToggle'

const Login = () => {
  const { currentUser, login, authError } = useContext(AuthContext)
  const { t } = useTranslation()
  const [credentials, setCredentials] = useState({ identifier: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Set page title
  usePageTitle('Login', 'Sign in to your ITSM Platform account')

  if (currentUser) return <Navigate to="/dashboard" replace />

  const handleChange = (e) => {
    const { name, value } = e.target
    setCredentials((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(credentials)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || t('login.error_invalid'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center mb-3">
          <CCol md={8} xl={6}>
            <div className="d-flex justify-content-between align-items-center gap-3">
              <Link
                to="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#6c757d',
                  textDecoration: 'none',
                  fontSize: 14,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#0d6efd'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6c757d'
                }}
              >
                <CIcon icon={cilArrowLeft} size="sm" />
                {t('login.back_home')}
              </Link>
              <LanguageToggle />
            </div>
          </CCol>
        </CRow>

        <CRow className="justify-content-center">
          <CCol md={3} xl={6}>
            <CCard className="p-4">
              <CCardBody>
                <h1>{t('login.title')}</h1>
                <p className="text-body-secondary">{t('login.subtitle')}</p>
                {error && <CAlert color="danger">{error}</CAlert>}
                {authError && !error && <CAlert color="danger">{authError}</CAlert>}
                <CForm onSubmit={handleSubmit}>
                  <CInputGroup className="mb-3">
                    <CInputGroupText>
                      <CIcon icon={cilUser} />
                    </CInputGroupText>
                    <CFormInput
                      placeholder={t('login.identifier_placeholder')}
                      name="identifier"
                      value={credentials.identifier}
                      onChange={handleChange}
                      autoComplete="username"
                      required
                    />
                  </CInputGroup>
                  <CInputGroup className="mb-4">
                    <CInputGroupText>
                      <CIcon icon={cilLockLocked} />
                    </CInputGroupText>
                    <CFormInput
                      type="password"
                      placeholder={t('login.password_placeholder')}
                      name="password"
                      value={credentials.password}
                      onChange={handleChange}
                      autoComplete="current-password"
                      required
                    />
                  </CInputGroup>
                  <div className="d-grid">
                    <CButton type="submit" color="primary" disabled={loading}>
                      {loading ? t('login.loading') : t('login.submit')}
                    </CButton>
                  </div>
                </CForm>

                <div className="text-center mt-3">
                  <Link to="/forgot-password" className="small text-decoration-none">
                    {t('login.forgot_password')}
                  </Link>
                </div>

                <div className="text-center mt-4">
                  <div className="text-body-secondary mb-3">
                    <span>{t('common.or')}</span>
                  </div>
                  <Link to="/register">
                    <CButton color="success" variant="outline">
                      {t('login.register_link')}
                    </CButton>
                  </Link>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login
