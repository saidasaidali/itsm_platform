// frontend/src/views/settings/Parametres.jsx
import React, { useContext, useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import usePageTitle from '../../utils/usePageTitle'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CCard, CCardBody, CCardHeader, CCol, CRow,
  CNav, CNavItem, CNavLink, CTabContent, CTabPane,
  CForm, CFormInput, CFormSelect, CButton,
  CToast, CToastBody, CToastHeader, CToaster,
  CSpinner, CAlert, CFormSwitch, CBadge,
  useColorModes,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilUser, cilContrast, cilGlobeAlt, cilSettings,
  cilSun, cilMoon, cilEnvelopeClosed, cilCloudDownload,
} from '@coreui/icons'
import api from '../../services/api'
import {
  getSystemSettings, updateSystemSettings,
  getPreferences, updatePreferences,
} from '../../services/settingsService'
import { translateRole } from '../../utils/translate'

const ROLE_COLORS = { Admin: '#e74c3c', Technicien: '#2980b9', Agent: '#27ae60' }

const applyLanguage = (lang) => {
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
  document.documentElement.setAttribute('lang', lang)
}

const Parametres = () => {
  const { t, i18n } = useTranslation()
  usePageTitle('Settings', 'Manage system settings and preferences')
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role
  const toaster = useRef()
  const [toast, addToast] = useState(0)

  const [activeTab, setActiveTab] = useState('compte')

  const showToast = (message, color = 'danger') => {
    addToast(
      <CToast color={color} autohide delay={4000}>
        <CToastHeader closeButton>
          <strong className="me-auto">{t('settings.title')}</strong>
        </CToastHeader>
        <CToastBody className={color === 'danger' ? 'text-white' : ''}>
          {message}
        </CToastBody>
      </CToast>
    )
  }

  const username = currentUser?.username || ''
  const initiale = username.charAt(0).toUpperCase()
  const roleColor = ROLE_COLORS[role] || '#6c757d'

  const [accountForm, setAccountForm] = useState({
    username: username,
    email: currentUser?.email || '',
    password: '',
    confirmPassword: '',
  })
  const [savingAccount, setSavingAccount] = useState(false)

  const handleAccountChange = (e) => {
    const { name, value } = e.target
    setAccountForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleAccountSubmit = async (e) => {
    e.preventDefault()
    if (accountForm.password && accountForm.password !== accountForm.confirmPassword) {
      showToast(t('settings.account.password_mismatch'))
      return
    }
    setSavingAccount(true)
    try {
      const payload = {}
      if (accountForm.username !== username) payload.username = accountForm.username
      if (accountForm.email !== currentUser?.email) payload.email = accountForm.email
      if (accountForm.password) payload.password = accountForm.password

      const data = await api.patch('/api/users/me', payload)

      const stored = localStorage.getItem('itsm-auth-user')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          const updated = { ...parsed, ...data.data }
          localStorage.setItem('itsm-auth-user', JSON.stringify(updated))
        } catch (err) {
          // Invalid JSON in localStorage, ignore and continue
          console.error('Failed to parse stored user data:', err)
        }
      }

      setAccountForm((prev) => ({ ...prev, password: '', confirmPassword: '' }))
      showToast(t('settings.account.success'), 'success')
    } catch (err) {
      showToast(err.message || t('settings.account.error'))
    } finally {
      setSavingAccount(false)
    }
  }

  const { colorMode, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')

  const [regionalForm, setRegionalForm] = useState({ 
    language: i18n.language || localStorage.getItem('itsm-lang') || 'fr', 
    date_format: 'DD/MM/YYYY' 
  })
  const [loadingRegional, setLoadingRegional] = useState(true)
  const [savingRegional, setSavingRegional] = useState(false)

  useEffect(() => {
    getPreferences()
      .then((prefs) => {
        const currentLang = i18n.language || localStorage.getItem('itsm-lang') || 'fr'
        setRegionalForm({
          language: prefs.language || currentLang,
          date_format: prefs.date_format || 'DD/MM/YYYY',
        })
      })
      .catch(() => {})
      .finally(() => setLoadingRegional(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRegionalChange = (e) => {
    const { name, value } = e.target
    setRegionalForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleRegionalSubmit = async (e) => {
    e.preventDefault()
    setSavingRegional(true)
    try {
      await updatePreferences(regionalForm)
      const lang = regionalForm.language
      i18n.changeLanguage(lang)
      localStorage.setItem('itsm-lang', lang)
      applyLanguage(lang)
      showToast(t('settings.regional.success'), 'success')
    } catch (err) {
      showToast(err.message || t('settings.regional.error'))
    } finally {
      setSavingRegional(false)
    }
  }

  const [systemForm, setSystemForm] = useState({
    smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_from: '',
    enable_ad_scan: 'false', enable_snmp_scan: 'false',
    enable_live_state: 'false', enable_auto_ticketing: 'false',
    ad_scan_interval_min: '60', snmp_scan_interval_min: '120',
    snmp_network_base: '', live_state_interval_min: '10',
    relation_interval_min: '360', auto_ticket_interval_min: '30',
    wmi_timeout_sec: '10', wmi_max_parallel: '32',
    wmi_retry_count: '1', wmi_retry_delay_sec: '2',
    wmi_verbose_logging: 'false',
  })
  const [loadingSystem, setLoadingSystem] = useState(role === 'Admin')
  const [savingSystem, setSavingSystem] = useState(false)

  useEffect(() => {
    if (role !== 'Admin') return
    getSystemSettings()
      .then((settings) => setSystemForm((prev) => ({ ...prev, ...settings })))
      .catch(() => showToast(t('settings.system.load_error')))
      .finally(() => setLoadingSystem(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  const handleSystemChange = (e) => {
    const { name, value } = e.target
    setSystemForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSystemToggle = (name) => {
    setSystemForm((prev) => ({
      ...prev,
      [name]: prev[name] === 'true' ? 'false' : 'true',
    }))
  }

  const handleSystemSubmit = async (e) => {
    e.preventDefault()
    setSavingSystem(true)
    try {
      await updateSystemSettings(systemForm)
      showToast(t('settings.system.success'), 'success')
    } catch (err) {
      showToast(err.message || t('settings.system.error'))
    } finally {
      setSavingSystem(false)
    }
  }

  return (
    <>
      <CToaster ref={toaster} push={toast} placement="top-end" />

      <CRow className="mb-4">
        <CCol>
          <h3 className="mb-0">{t('settings.title')}</h3>
          <small className="text-muted">{t('settings.subtitle')}</small>
        </CCol>
      </CRow>

      <CRow>
        <CCol>
          <CCard>
            <CCardHeader className="p-0">
              <CNav variant="tabs" className="border-0 px-2 pt-2">
                <CNavItem>
                  <CNavLink active={activeTab === 'compte'} onClick={() => setActiveTab('compte')} style={{ cursor: 'pointer' }}>
                    <CIcon icon={cilUser} className="me-2" />
                    {t('settings.tabs.account')}
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink active={activeTab === 'apparence'} onClick={() => setActiveTab('apparence')} style={{ cursor: 'pointer' }}>
                    <CIcon icon={cilContrast} className="me-2" />
                    {t('settings.tabs.appearance')}
                  </CNavLink>
                </CNavItem>
                <CNavItem>
                  <CNavLink active={activeTab === 'regional'} onClick={() => setActiveTab('regional')} style={{ cursor: 'pointer' }}>
                    <CIcon icon={cilGlobeAlt} className="me-2" />
                    {t('settings.tabs.regional')}
                  </CNavLink>
                </CNavItem>
                {role === 'Admin' && (
                  <CNavItem>
                    <CNavLink active={activeTab === 'systeme'} onClick={() => setActiveTab('systeme')} style={{ cursor: 'pointer' }}>
                      <CIcon icon={cilSettings} className="me-2" />
                      {t('settings.tabs.system')}
                    </CNavLink>
                  </CNavItem>
                )}
              </CNav>
            </CCardHeader>

            <CCardBody>
              <CTabContent>

                <CTabPane visible={activeTab === 'compte'}>
                  <CRow className="justify-content-center">
                    <CCol md={8} lg={6}>
                      <div className="text-center mb-4">
                        <div style={{
                          width: '72px', height: '72px', borderRadius: '50%',
                          backgroundColor: roleColor, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '32px', margin: '0 auto 12px',
                          boxShadow: `0 4px 16px ${roleColor}55`,
                        }}>
                          {initiale}
                        </div>
                        <h5 className="mb-0">{username}</h5>
                        <CBadge style={{ backgroundColor: roleColor }} className="mt-1">{translateRole(role)}</CBadge>
                      </div>

                      <CForm onSubmit={handleAccountSubmit}>
                        <div className="mb-3">
                          <CFormInput
                            label={t('settings.account.username')}
                            name="username"
                            value={accountForm.username}
                            onChange={handleAccountChange}
                            required
                          />
                        </div>
                        <div className="mb-3">
                          <CFormInput
                            type="email"
                            label={t('settings.account.email')}
                            name="email"
                            value={accountForm.email}
                            onChange={handleAccountChange}
                            required
                          />
                        </div>
                        <hr />
                        <p className="text-muted small mb-3">
                          {t('settings.account.password_hint')}
                        </p>
                        <div className="mb-3">
                          <CFormInput
                            type="password"
                            label={t('settings.account.new_password')}
                            name="password"
                            value={accountForm.password}
                            onChange={handleAccountChange}
                            autoComplete="new-password"
                          />
                        </div>
                        <div className="mb-4">
                          <CFormInput
                            type="password"
                            label={t('settings.account.confirm_password')}
                            name="confirmPassword"
                            value={accountForm.confirmPassword}
                            onChange={handleAccountChange}
                            autoComplete="new-password"
                          />
                        </div>
                        <CButton type="submit" color="primary" disabled={savingAccount} className="w-100">
                          {savingAccount ? t('settings.account.saving') : t('settings.account.save')}
                        </CButton>
                      </CForm>
                    </CCol>
                  </CRow>
                </CTabPane>

                <CTabPane visible={activeTab === 'apparence'}>
                  <CRow className="justify-content-center">
                    <CCol md={8} lg={6}>
                      <h6 className="mb-1">{t('settings.appearance.title')}</h6>
                      <p className="text-muted small mb-4">
                        {t('settings.appearance.desc')}
                      </p>

                      <div className="d-flex gap-3">
                        <div
                          onClick={() => setColorMode('light')}
                          style={{
                            flex: 1, padding: '20px', borderRadius: '10px', cursor: 'pointer',
                            border: colorMode === 'light' ? '2px solid #3b82f6' : '1px solid var(--cui-border-color)',
                            background: 'var(--cui-tertiary-bg)', textAlign: 'center',
                            transition: 'border-color 0.15s',
                          }}
                        >
                          <CIcon icon={cilSun} size="xl" className="mb-2" />
                          <div className="fw-semibold">{t('theme.light')}</div>
                          {colorMode === 'light' && (
                            <CBadge color="primary" className="mt-2">{t('settings.appearance.active')}</CBadge>
                          )}
                        </div>

                        <div
                          onClick={() => setColorMode('dark')}
                          style={{
                            flex: 1, padding: '20px', borderRadius: '10px', cursor: 'pointer',
                            border: colorMode === 'dark' ? '2px solid #3b82f6' : '1px solid var(--cui-border-color)',
                            background: 'var(--cui-tertiary-bg)', textAlign: 'center',
                            transition: 'border-color 0.15s',
                          }}
                        >
                          <CIcon icon={cilMoon} size="xl" className="mb-2" />
                          <div className="fw-semibold">{t('theme.dark')}</div>
                          {colorMode === 'dark' && (
                            <CBadge color="primary" className="mt-2">{t('settings.appearance.active')}</CBadge>
                          )}
                        </div>
                      </div>
                    </CCol>
                  </CRow>
                </CTabPane>

                <CTabPane visible={activeTab === 'regional'}>
                  {loadingRegional ? (
                    <div className="text-center p-5"><CSpinner /></div>
                  ) : (
                    <CRow className="justify-content-center">
                      <CCol md={8} lg={6}>
                        <h6 className="mb-1">{t('settings.regional.title')}</h6>
                        <p className="text-muted small mb-4">
                          {t('settings.regional.desc')}
                        </p>

                        <CForm onSubmit={handleRegionalSubmit}>
                          <div className="mb-3">
                            <CFormSelect
                              label={t('settings.regional.language')}
                              name="language"
                              value={regionalForm.language}
                              onChange={handleRegionalChange}
                            >
                              <option value="fr">{t('lang.fr')}</option>
                              <option value="ar">{t('lang.ar')}</option>
                              <option value="en">{t('lang.en')}</option>
                            </CFormSelect>
                          </div>

                          <div className="mb-4">
                            <CFormSelect
                              label={t('settings.regional.date_format')}
                              name="date_format"
                              value={regionalForm.date_format}
                              onChange={handleRegionalChange}
                            >
                              <option value="DD/MM/YYYY">{t('settings.regional.date_dmy')}</option>
                              <option value="YYYY-MM-DD">{t('settings.regional.date_ymd')}</option>
                              <option value="MM/DD/YYYY">{t('settings.regional.date_mdy')}</option>
                            </CFormSelect>
                          </div>

                          <CButton type="submit" color="primary" disabled={savingRegional}>
                            {savingRegional ? t('settings.regional.saving') : t('settings.regional.save')}
                          </CButton>
                        </CForm>
                      </CCol>
                    </CRow>
                  )}
                </CTabPane>

                {role === 'Admin' && (
                  <CTabPane visible={activeTab === 'systeme'}>
                    {loadingSystem ? (
                      <div className="text-center p-5"><CSpinner /></div>
                    ) : (
                      <CRow className="justify-content-center">
                        <CCol lg={9}>
                          <CAlert color="info" className="d-flex align-items-start gap-2">
                            <CIcon icon={cilSettings} className="mt-1 flex-shrink-0" />
                            <div>{t('settings.system.info')}</div>
                          </CAlert>

                          <CForm onSubmit={handleSystemSubmit}>
                            <h6 className="mt-4 mb-3 d-flex align-items-center gap-2">
                              <CIcon icon={cilEnvelopeClosed} />
                              {t('settings.system.smtp_title')}
                            </h6>
                            <CRow className="g-3 mb-4">
                              <CCol md={6}>
                                <CFormInput
                                  label={t('settings.system.smtp_host')}
                                  name="smtp_host"
                                  value={systemForm.smtp_host}
                                  onChange={handleSystemChange}
                                  placeholder={t('settings.system.smtp_host_placeholder')}
                                />
                              </CCol>
                              <CCol md={6}>
                                <CFormInput
                                  label={t('settings.system.smtp_port')}
                                  name="smtp_port"
                                  value={systemForm.smtp_port}
                                  onChange={handleSystemChange}
                                  placeholder={t('settings.system.smtp_port_placeholder')}
                                />
                              </CCol>
                              <CCol md={6}>
                                <CFormInput
                                  label={t('settings.system.smtp_user')}
                                  name="smtp_user"
                                  value={systemForm.smtp_user}
                                  onChange={handleSystemChange}
                                />
                              </CCol>
                              <CCol md={6}>
                                <CFormInput
                                  type="password"
                                  label={t('settings.system.smtp_pass')}
                                  name="smtp_pass"
                                  value={systemForm.smtp_pass}
                                  onChange={handleSystemChange}
                                  placeholder={t('settings.system.smtp_pass_placeholder')}
                                />
                              </CCol>
                              <CCol md={6}>
                                <CFormInput
                                  type="email"
                                  label={t('settings.system.smtp_from')}
                                  name="smtp_from"
                                  value={systemForm.smtp_from}
                                  onChange={handleSystemChange}
                                  placeholder={t('settings.system.smtp_from_placeholder')}
                                />
                              </CCol>
                            </CRow>

                            <h6 className="mt-4 mb-3 d-flex align-items-center gap-2">
                              <CIcon icon={cilCloudDownload} />
                              {t('settings.system.modules_title')}
                            </h6>

                            <div className="d-flex align-items-center justify-content-between py-2 border-bottom">
                              <div>
                                <div className="fw-semibold">{t('settings.system.ad_scan')}</div>
                                <div className="text-muted small">{t('settings.system.ad_scan_desc')}</div>
                              </div>
                              <CFormSwitch
                                checked={systemForm.enable_ad_scan === 'true'}
                                onChange={() => handleSystemToggle('enable_ad_scan')}
                              />
                            </div>

                            <div className="d-flex align-items-center justify-content-between py-2 border-bottom">
                              <div>
                                <div className="fw-semibold">{t('settings.system.snmp_scan')}</div>
                                <div className="text-muted small">{t('settings.system.snmp_scan_desc')}</div>
                              </div>
                              <CFormSwitch
                                checked={systemForm.enable_snmp_scan === 'true'}
                                onChange={() => handleSystemToggle('enable_snmp_scan')}
                              />
                            </div>

                            <div className="d-flex align-items-center justify-content-between py-2 border-bottom">
                              <div>
                                <div className="fw-semibold">{t('settings.system.live_state')}</div>
                                <div className="text-muted small">{t('settings.system.live_state_desc')}</div>
                              </div>
                              <CFormSwitch
                                checked={systemForm.enable_live_state === 'true'}
                                onChange={() => handleSystemToggle('enable_live_state')}
                              />
                            </div>

                            <div className="d-flex align-items-center justify-content-between py-2 mb-4 border-bottom">
                              <div>
                                <div className="fw-semibold">{t('settings.system.auto_ticketing')}</div>
                                <div className="text-muted small">{t('settings.system.auto_ticketing_desc')}</div>
                              </div>
                              <CFormSwitch
                                checked={systemForm.enable_auto_ticketing === 'true'}
                                onChange={() => handleSystemToggle('enable_auto_ticketing')}
                              />
                            </div>

                            <h6 className="mb-3">{t('settings.system.intervals_title')}</h6>
                            <CRow className="g-3 mb-4">
                              <CCol md={6} lg={4}>
                                <CFormInput
                                  label={t('settings.system.interval_ad')}
                                  name="ad_scan_interval_min"
                                  value={systemForm.ad_scan_interval_min}
                                  onChange={handleSystemChange}
                                />
                              </CCol>
                              <CCol md={6} lg={4}>
                                <CFormInput
                                  label={t('settings.system.interval_snmp')}
                                  name="snmp_scan_interval_min"
                                  value={systemForm.snmp_scan_interval_min}
                                  onChange={handleSystemChange}
                                />
                              </CCol>
                              <CCol md={6} lg={4}>
                                <CFormInput
                                  label={t('settings.system.interval_live')}
                                  name="live_state_interval_min"
                                  value={systemForm.live_state_interval_min}
                                  onChange={handleSystemChange}
                                />
                              </CCol>
                              <CCol md={6} lg={4}>
                                <CFormInput
                                  label={t('settings.system.interval_relations')}
                                  name="relation_interval_min"
                                  value={systemForm.relation_interval_min}
                                  onChange={handleSystemChange}
                                />
                              </CCol>
                              <CCol md={6} lg={4}>
                                <CFormInput
                                  label={t('settings.system.interval_auto_tickets')}
                                  name="auto_ticket_interval_min"
                                  value={systemForm.auto_ticket_interval_min}
                                  onChange={handleSystemChange}
                                />
                              </CCol>
                              <CCol md={6} lg={4}>
                                <CFormInput
                                  label={t('settings.system.snmp_subnet')}
                                  name="snmp_network_base"
                                  value={systemForm.snmp_network_base}
                                  onChange={handleSystemChange}
                                  placeholder={t('settings.system.snmp_subnet_placeholder')}
                                />
                              </CCol>
                            </CRow>

                            <h6 className="mt-4 mb-3 d-flex align-items-center gap-2">
                              <CIcon icon={cilSettings} />
                              {t('settings.system.wmi_title')}
                            </h6>
                            <CRow className="g-3 mb-4">
                              <CCol md={6} lg={4}>
                                <CFormInput
                                  label={t('settings.system.wmi_timeout')}
                                  name="wmi_timeout_sec"
                                  value={systemForm.wmi_timeout_sec}
                                  onChange={handleSystemChange}
                                  placeholder="10"
                                />
                              </CCol>
                              <CCol md={6} lg={4}>
                                <CFormInput
                                  label={t('settings.system.wmi_max_parallel')}
                                  name="wmi_max_parallel"
                                  value={systemForm.wmi_max_parallel}
                                  onChange={handleSystemChange}
                                  placeholder="32"
                                />
                              </CCol>
                              <CCol md={6} lg={4}>
                                <CFormInput
                                  label={t('settings.system.wmi_retry_count')}
                                  name="wmi_retry_count"
                                  value={systemForm.wmi_retry_count}
                                  onChange={handleSystemChange}
                                  placeholder="1"
                                />
                              </CCol>
                              <CCol md={6} lg={4}>
                                <CFormInput
                                  label={t('settings.system.wmi_retry_delay')}
                                  name="wmi_retry_delay_sec"
                                  value={systemForm.wmi_retry_delay_sec}
                                  onChange={handleSystemChange}
                                  placeholder="2"
                                />
                              </CCol>
                              <CCol md={6} lg={4}>
                                <div className="d-flex align-items-center justify-content-between py-2">
                                  <div>
                                    <div className="fw-semibold">{t('settings.system.wmi_verbose_title')}</div>
                                    <div className="text-muted small">{t('settings.system.wmi_verbose_desc')}</div>
                                  </div>
                                  <CFormSwitch
                                    checked={systemForm.wmi_verbose_logging === 'true'}
                                    onChange={() => handleSystemToggle('wmi_verbose_logging')}
                                  />
                                </div>
                              </CCol>
                            </CRow>

                            <CButton type="submit" color="primary" disabled={savingSystem}>
                              {savingSystem ? t('settings.system.saving') : t('settings.system.save')}
                            </CButton>
                          </CForm>
                        </CCol>
                      </CRow>
                    )}
                  </CTabPane>
                )}

              </CTabContent>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default Parametres
