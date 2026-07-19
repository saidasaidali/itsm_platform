// frontend/src/views/auth/ForgotPassword.jsx
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CButton, CCard, CCardBody, CCol, CContainer, CForm,
  CFormInput, CRow, CAlert,
} from '@coreui/react'
import { useTranslation } from 'react-i18next'
import { forgotPassword } from '../../services/authService'
import usePageTitle from '../../utils/usePageTitle'

const ForgotPassword = () => {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const { t } = useTranslation()

  // Set page title
  usePageTitle('Forgot Password', 'Reset your password')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.message || t('common.generic_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={6} lg={5}>
            <CCard className="p-4">
              <CCardBody>
                <h4 className="mb-1">{t('forgot_password.title')}</h4>
                <p className="text-muted small mb-4">
                  {t('forgot_password.subtitle')}
                </p>

                {sent ? (
                  <CAlert color="success">
                    {t('forgot_password.success')}
                  </CAlert>
                ) : (
                  <CForm onSubmit={handleSubmit}>
                    {error && <CAlert color="danger">{error}</CAlert>}
                    <div className="mb-3">
                      <CFormInput
                        type="email"
                        placeholder={t('forgot_password.email_placeholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <CButton type="submit" color="primary" className="w-100" disabled={loading}>
                      {loading ? t('forgot_password.loading') : t('forgot_password.submit')}
                    </CButton>
                  </CForm>
                )}

                <div className="text-center mt-3">
                  <Link to="/login" className="small text-decoration-none">
                    {t('forgot_password.back_login')}
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

export default ForgotPassword