import React, { useContext, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  CButton, CCard, CCardBody, CCardGroup, CCol, CContainer,
  CForm, CFormInput, CInputGroup, CInputGroupText, CRow, CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser, cilArrowLeft } from '@coreui/icons'
import { AuthContext } from '../../../auth/AuthProvider'

const Login = () => {
  const { currentUser, login, authError } = useContext(AuthContext)
  const [credentials, setCredentials] = useState({ identifier: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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
      setError(err.message || 'Identifiants invalides')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        {/* ← Retour à l'accueil */}
        <CRow className="justify-content-center mb-3">
          <CCol md={8} xl={6}>
            <Link to="/" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: '#6c757d', textDecoration: 'none', fontSize: 14,
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = '#0d6efd'}
              onMouseLeave={e => e.currentTarget.style.color = '#6c757d'}
            >
              <CIcon icon={cilArrowLeft} size="sm" />
              Retour à l'accueil
            </Link>
          </CCol>
        </CRow>

        <CRow className="justify-content-center">
          <CCol md={8} xl={6}>
            <CCardGroup>
              <CCard className="p-4">
                <CCardBody>
                  <h1>Connexion</h1>
                  <p className="text-body-secondary">Connectez-vous à votre espace ITSM</p>
                  {error && <CAlert color="danger">{error}</CAlert>}
                  {authError && !error && <CAlert color="danger">{authError}</CAlert>}
                  <CForm onSubmit={handleSubmit}>
                    <CInputGroup className="mb-3">
                      <CInputGroupText><CIcon icon={cilUser} /></CInputGroupText>
                      <CFormInput
                        placeholder="Identifiant (username ou email)"
                        name="identifier"
                        value={credentials.identifier}
                        onChange={handleChange}
                        autoComplete="username"
                        required
                      />
                    </CInputGroup>
                    <CInputGroup className="mb-4">
                      <CInputGroupText><CIcon icon={cilLockLocked} /></CInputGroupText>
                      <CFormInput
                        type="password"
                        placeholder="Mot de passe"
                        name="password"
                        value={credentials.password}
                        onChange={handleChange}
                        autoComplete="current-password"
                        required
                      />
                    </CInputGroup>
                    <div className="d-grid">
                      <CButton type="submit" color="primary" disabled={loading}>
                        {loading ? 'Connexion...' : 'Se connecter'}
                      </CButton>
                    </div>
                  </CForm>
                </CCardBody>
              </CCard>

              <CCard className="text-white bg-primary py-5 d-none d-md-block" style={{ width: '44%' }}>
                <CCardBody className="text-center">
                  <h2>Bienvenue</h2>
                  <p>Gérez les tickets, le parc matériel, la base de connaissance et les notifications depuis une interface ITSM dédiée.</p>
                  <Link to="/register">
                    <CButton color="light" className="mt-3" tabIndex={-1}>
                      Créer un compte
                    </CButton>
                  </Link>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login