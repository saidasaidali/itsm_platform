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
  CFormLabel,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CRow,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser, cilEnvelopeClosed, cilPeople } from '@coreui/icons'
import { AuthContext } from '../../../auth/AuthProvider'

const ROLES = [
  { id: 2, label: 'Technicien' },
  { id: 3, label: 'Agent' },
]

const Register = () => {
  const { register } = useContext(AuthContext)
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
      setError('Veuillez remplir tous les champs.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
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
      setError(registerError.message || 'Impossible de créer le compte.')
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
                  <h2 className="mb-3">Demande envoyée !</h2>
                  <p className="text-body-secondary mb-4">
                    Votre compte a été créé avec succès. Un administrateur doit valider votre
                    accès avant que vous puissiez vous connecter.
                    <br /><br />
                    Vous serez notifié dès que votre compte sera activé.
                  </p>
                  <Link to="/login">
                    <CButton color="primary">Retour à la connexion</CButton>
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
          <CCol md={8} xl={10}>
            <CCardGroup>
              <CCard className="p-4">
                <CCardBody>
                  <h1>Créer un compte</h1>
                  <p className="text-body-secondary">Inscrivez-vous pour accéder à la plateforme ITSM</p>

                  {error && <CAlert color="danger">{error}</CAlert>}

                  <CForm onSubmit={handleSubmit}>
                    {/* Nom d'utilisateur */}
                    <CInputGroup className="mb-3">
                      <CInputGroupText>
                        <CIcon icon={cilUser} />
                      </CInputGroupText>
                      <CFormInput
                        placeholder="Nom d'utilisateur"
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
                        placeholder="Email"
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
                        <option value="">-- Sélectionnez votre rôle --</option>
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
                        placeholder="Mot de passe"
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
                        placeholder="Confirmer le mot de passe"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        autoComplete="new-password"
                        required
                      />
                    </CInputGroup>

                    <div className="d-grid">
                      <CButton type="submit" color="success" disabled={loading}>
                        {loading ? 'Création en cours...' : 'Créer mon compte'}
                      </CButton>
                    </div>
                  </CForm>

                  <div className="text-center mt-3">
                    <small>
                      Déjà un compte ?{' '}
                      <Link to="/login" className="text-primary">
                        Se connecter
                      </Link>
                    </small>
                  </div>
                </CCardBody>
              </CCard>

              <CCard className="text-white bg-primary py-5 d-none d-md-block" style={{ width: '44%' }}>
                <CCardBody className="text-center">
                  <div>
                    <h2>Bienvenue</h2>
                    <p>
                      Gérez les tickets, le parc matériel, la base de connaissance et les
                      notifications depuis une interface ITSM dédiée.
                    </p>
                    <hr className="border-white opacity-50 my-4" />
                    <p className="mb-0 small opacity-75">
                      ⏳ Après votre inscription, un administrateur validera votre accès.
                    </p>
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