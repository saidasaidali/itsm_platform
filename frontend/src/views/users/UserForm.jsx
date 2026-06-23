// src/views/users/UserForm.jsx
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { translateRole } from '../../utils/translate'
import { createUser, getUserById, updateUser, getRoles } from '../../services/userService'

const UserForm = () => {
  const navigate = useNavigate()
  const { userId } = useParams()
  const id = userId
  const isEditMode = Boolean(id)
  const { t } = useTranslation()

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
        .catch(() => setError(t('users.form_load_error')))
        .finally(() => setLoading(false))
    }
  }, [id, isEditMode, t])

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
      setError(submitError.message || (isEditMode ? t('users.form_update_error') : t('users.form_create_error')))
    } finally {
      setSaving(false)
    }
  }

  // ─── États de chargement ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <p className="mt-2 text-muted">{t('users.loading')}</p>
      </div>
    )
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <CRow>
      <CCol xs={12} md={8} lg={6}>
        <CCard className="mb-4">
          <CCardHeader className="fw-semibold">
            {isEditMode ? t('users.form_edit_title') : t('users.add_user')}
          </CCardHeader>
          <CCardBody>
            {error && <CAlert color="danger">{error}</CAlert>}

            <CForm onSubmit={handleSubmit}>
              <CRow className="g-3">

                {/* Nom d'utilisateur */}
                <CCol md={6}>
                  <CFormInput
                    label={t('users.col_username')}
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
                    label={t('users.col_email')}
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
                    label={isEditMode ? t('users.form_password_edit') : t('users.form_password')}
                    name="password"
                    value={userData.password}
                    onChange={handleChange}
                    required={!isEditMode}
                    autoComplete="new-password"
                    placeholder={isEditMode ? t('users.form_password_edit_placeholder') : ''}
                  />
                </CCol>

                {/* Rôle */}
                <CCol md={6}>
                  <CFormSelect
                    label={t('users.col_role')}
                    name="role_id"
                    value={userData.role_id}
                    onChange={handleChange}
                    required
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {translateRole(role.label)}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>

              </CRow>

              <div className="mt-4 d-flex gap-2">
                <CButton type="submit" color="primary" disabled={saving}>
                  {saving
                    ? t('users.form_saving')
                    : isEditMode ? t('users.form_save_changes') : t('users.form_create_btn')}
                </CButton>
                <CButton
                  type="button"
                  color="secondary"
                  variant="outline"
                  onClick={() => navigate('/users')}
                  disabled={saving}
                >
                  {t('users.modal_cancel')}
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