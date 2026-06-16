// src/views/users/UserForm.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormSelect,
  CRow,
  CAlert,
  CSpinner,
} from '@coreui/react'
import { createUser, getUserById, updateUser, getRoles } from '../../services/userService'

const UserForm = () => {
  const navigate = useNavigate()
  const { userId } = useParams()
  const id = userId 
  const isEditMode = Boolean(id)

  const [roles, setRoles] = useState([])
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    password: '',
    role_id: 3, // Agent par défaut
  })
  const [loading, setLoading]   = useState(isEditMode) // charge l'utilisateur si édition
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  // ─── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => {
    getRoles().then(setRoles)

    if (isEditMode) {
      getUserById(id)
        .then((user) => {
          setUserData({
            username: user.name,   // mapUser retourne 'name' pour username
            email:    user.email,
            password: '',          // ne pas pré-remplir le mot de passe
            role_id:  user.role_id,
          })
        })
        .catch(() => setError('Impossible de charger l\'utilisateur.'))
        .finally(() => setLoading(false))
    }
  }, [id, isEditMode])

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleChange = (event) => {
    const { name, value } = event.target
    setUserData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (isEditMode) {
        // En mode édition : n'envoyer le password que s'il a été saisi
        const updates = {
          username: userData.username,
          email:    userData.email,
          role_id:  Number(userData.role_id),
          ...(userData.password ? { password: userData.password } : {}),
        }
        await updateUser(id, updates)
      } else {
        // En mode création : tous les champs sont requis
        await createUser({
          username: userData.username,
          email:    userData.email,
          password: userData.password,
          role_id:  Number(userData.role_id),
        })
      }
      navigate('/users')
    } catch (submitError) {
      setError(submitError.message || `Impossible de ${isEditMode ? 'modifier' : 'créer'} l'utilisateur.`)
    } finally {
      setSaving(false)
    }
  }

  // ─── États de chargement ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <p className="mt-2 text-muted">Chargement...</p>
      </div>
    )
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <CRow>
      <CCol xs={12} md={8} lg={6}>
        <CCard className="mb-4">
          <CCardHeader className="fw-semibold">
            {isEditMode ? `Modifier l'utilisateur` : 'Créer un utilisateur'}
          </CCardHeader>
          <CCardBody>
            {error && <CAlert color="danger">{error}</CAlert>}

            <CForm onSubmit={handleSubmit}>
              <CRow className="g-3">

                {/* Nom d'utilisateur */}
                <CCol md={6}>
                  <CFormInput
                    label="Nom d'utilisateur"
                    name="username"
                    value={userData.username}
                    onChange={handleChange}
                    required
                    autoComplete="off"
                  />
                </CCol>

                {/* Email */}
                <CCol md={6}>
                  <CFormInput
                    type="email"
                    label="Email"
                    name="email"
                    value={userData.email}
                    onChange={handleChange}
                    required
                    autoComplete="off"
                  />
                </CCol>

                {/* Mot de passe */}
                <CCol md={6}>
                  <CFormInput
                    type="password"
                    label={isEditMode ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}
                    name="password"
                    value={userData.password}
                    onChange={handleChange}
                    required={!isEditMode}
                    autoComplete="new-password"
                    placeholder={isEditMode ? 'Laisser vide pour ne pas modifier' : ''}
                  />
                </CCol>

                {/* Rôle */}
                <CCol md={6}>
                  <CFormSelect
                    label="Rôle"
                    name="role_id"
                    value={userData.role_id}
                    onChange={handleChange}
                    required
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>

              </CRow>

              <div className="mt-4 d-flex gap-2">
                <CButton type="submit" color="primary" disabled={saving}>
                  {saving
                    ? 'Enregistrement...'
                    : isEditMode ? 'Enregistrer les modifications' : 'Créer l\'utilisateur'}
                </CButton>
                <CButton
                  type="button"
                  color="secondary"
                  variant="outline"
                  onClick={() => navigate('/users')}
                  disabled={saving}
                >
                  Annuler
                </CButton>
              </div>
            </CForm>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default UserForm