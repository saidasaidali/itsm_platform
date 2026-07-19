// frontend/src/views/auth/ResetPassword.jsx
import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  CButton, CCard, CCardBody, CCol, CContainer, CForm,
  CFormInput, CRow, CAlert, CSpinner,
} from '@coreui/react'
import { useTranslation } from 'react-i18next'
import { checkResetToken, resetPassword } from '../../services/authService'
import usePageTitle from '../../utils/usePageTitle'

const ResetPassword = () => {
  const { token } = useParams()
  const navigate   = useNavigate()
  const { t } = useTranslation()

  // Set page title
  usePageTitle('Reset Password', 'Create a new password')

  const [checking, setChecking]   = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    checkResetToken(token)
      .then(() => setTokenValid(true))
      .catch(() => setTokenValid(false))
      .finally(() => setChecking(false))
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setError(t('reset_password.error_mismatch'))
      return
    }
    if (password.length < 6) {
      setError(t('reset_password.error_length'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await resetPassword(token, password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.message || t('reset_password.error_generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={6} lg={5}>
            <CCard className="p-4">
              <CCardBody>
                <h4 className="mb-4">{t('reset_password.title')}</h4>

                {checking ? (
                  <div className="text-center p-3"><CSpinner /></div>
                ) : !tokenValid ? (
                  <>
                    <CAlert color="danger">
                      {t('reset_password.invalid_token')}
                    </CAlert>
                    <Link to="/forgot-password" className="small text-decoration-none">
                      {t('reset_password.request_new')}
                    </Link>
                  </>
                ) : success ? (
                  <CAlert color="success">
                    {t('reset_password.success')}
                  </CAlert>
                ) : (
                  <CForm onSubmit={handleSubmit}>
                    {error && <CAlert color="danger">{error}</CAlert>}
                    <div className="mb-3">
                      <CFormInput
                        type="password"
                        label={t('reset_password.password_label')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <CFormInput
                        type="password"
                        label={t('reset_password.confirm_label')}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                    </div>
                    <CButton type="submit" color="primary" className="w-100" disabled={saving}>
                      {saving ? t('reset_password.saving') : t('reset_password.submit')}
                    </CButton>
                  </CForm>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default ResetPassword