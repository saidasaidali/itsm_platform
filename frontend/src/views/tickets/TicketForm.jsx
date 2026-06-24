import React, { useEffect, useState, useContext, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CAlert,
  CFormInput,
  CFormSelect,
  CFormTextarea,
  CRow,
  CToast,
  CToastBody,
  CToaster,
  CToastHeader,
} from '@coreui/react'
import { createTicket, getTicketById } from '../../services/ticketService'
import { getAssets } from '../../services/assetService'

const CATEGORIES = ['Matériel', 'Logiciel', 'Réseau', 'Accès / Droits', 'Imprimante', 'Autre']
const PRIORITIES = ['Haute', 'Moyenne', 'Basse']

const TicketForm = () => {
  const { ticketId } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(ticketId)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { currentUser } = useContext(AuthContext)
  const toaster = useRef()
  const [toast, addToast] = useState(0)
  const [saving, setSaving] = useState(false)
  const [assets, setAssets] = useState([])

  const preselectedAssetId = searchParams.get('assetId') || ''

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Moyenne',
    category: '',
    assetId: preselectedAssetId,
  })

  const showToast = (message, color = 'danger') => {
    addToast(
      <CToast color={color} autohide delay={4000}>
        <CToastHeader closeButton>
          <strong className="me-auto">{t('common.notification')}</strong>
        </CToastHeader>
        <CToastBody className={color === 'danger' ? 'text-white' : ''}>{message}</CToastBody>
      </CToast>,
    )
  }

  useEffect(() => {
    getAssets()
      .then((data) => setAssets(data || []))
      .catch(() => setAssets([]))
    if (isEdit) {
      getTicketById(ticketId)
        .then((ticket) =>
          setForm({
            title: ticket.title,
            description: ticket.description,
            priority: ticket.priority,
            category: ticket.category,
            assetId: ticket.assetId || '',
          }),
        )
        .catch(() => showToast(t('tickets.form.load_error')))
    }
  }, [isEdit, ticketId, t])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (currentUser?.role !== 'Agent') {
      showToast(t('tickets.form.agent_only'))
      return
    }
    setSaving(true)
    try {
      await createTicket(form)
      showToast(t('tickets.form.create_success'), 'success')
      setTimeout(() => navigate('/tickets'), 1000)
    } catch (err) {
      showToast(err.message || t('common.generic_error'))
    } finally {
      setSaving(false)
    }
  }

  const translatePriority = (priority) => t(`tickets.priority.${priority}`, { defaultValue: priority })
  const translateCategory = (category) => t(`tickets.category.${category}`, { defaultValue: category })

  if (currentUser?.role !== 'Agent') {
    return <CAlert color="warning">{t('tickets.form.creation_reserved')}</CAlert>
  }

  return (
    <CRow>
      <CToaster ref={toaster} push={toast} placement="top-end" />
      <CCol xs={12}>
        <CCard>
          <CCardHeader>
            <strong>{t('tickets.form.new_title')}</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>
              <CRow className="mb-3">
                <CCol md={8}>
                  <CFormInput
                    label={t('tickets.fields.title_required')}
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    required
                    placeholder={t('tickets.form.title_placeholder')}
                  />
                </CCol>
                <CCol md={4}>
                  <CFormSelect
                    label={t('tickets.fields.priority')}
                    name="priority"
                    value={form.priority}
                    onChange={handleChange}
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {t(`tickets.priority_with_sla.${priority}`, {
                          defaultValue: translatePriority(priority),
                        })}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
              </CRow>

              <CRow className="mb-3">
                <CCol md={4}>
                  <CFormSelect
                    label={t('tickets.fields.category')}
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                  >
                    <option value="">{t('common.select')}</option>
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {translateCategory(category)}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>

                <CCol md={8}>
                  <CFormSelect
                    label={t('tickets.form.related_asset')}
                    name="assetId"
                    value={form.assetId}
                    onChange={handleChange}
                  >
                    <option value="">{t('tickets.form.no_asset')}</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.assetTag} - {asset.brand} {asset.model}
                        {asset.assignedTo
                          ? ` (${t('tickets.form.assigned_to_user', { user: asset.assignedTo })})`
                          : ''}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
              </CRow>

              <CRow className="mb-3">
                <CCol md={12}>
                  <CFormTextarea
                    label={t('tickets.fields.description_required')}
                    name="description"
                    rows={5}
                    value={form.description}
                    onChange={handleChange}
                    required
                    placeholder={t('tickets.form.description_placeholder')}
                  />
                </CCol>
              </CRow>

              <div className="d-flex gap-2">
                <CButton type="submit" color="primary" disabled={saving}>
                  {saving ? t('tickets.form.creating') : t('tickets.form.create')}
                </CButton>
                <CButton color="secondary" onClick={() => navigate('/tickets')}>
                  {t('common.cancel')}
                </CButton>
              </div>
            </CForm>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default TicketForm
