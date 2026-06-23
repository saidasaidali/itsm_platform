import React, { useEffect, useState, useRef } from 'react'
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
  CToast,
  CToastBody,
  CToaster,
  CToastHeader,
} from '@coreui/react'
import { createAsset, updateAsset, getAssetById } from '../../services/assetService'
import { getUsers } from '../../services/userService'

const TYPES = ['Ordinateur portable', 'Ordinateur fixe', 'Imprimante', 'Écran', 'Téléphone', 'Switch', 'Serveur', 'Autre']
const STATUSES = ['En service', 'En panne', 'En maintenance', 'Retiré']

const AssetForm = () => {
  const { assetId } = useParams()
  const isEdit = Boolean(assetId)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const toaster = useRef()
  const [toast, addToast] = useState(0)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState([])

  const [form, setForm] = useState({
    assetTag: '',
    type: '',
    brand: '',
    model: '',
    status: 'En service',
    location: '',
    serialNumber: '',
    department: '',
    office: '',
    purchaseDate: '',
    warrantyEnd: '',
    assignedToId: '',
  })

  const showToast = (message, color = 'danger') => {
    addToast(
      <CToast color={color} autohide delay={4000}>
        <CToastHeader closeButton>
          <strong className="me-auto">{t('assets.common.asset')}</strong>
        </CToastHeader>
        <CToastBody className={color === 'danger' ? 'text-white' : ''}>{message}</CToastBody>
      </CToast>,
    )
  }

  useEffect(() => {
    getUsers().then(setUsers).catch(console.error)
    if (isEdit) {
      getAssetById(assetId)
        .then((asset) =>
          setForm({
            assetTag: asset.assetTag,
            type: asset.type,
            brand: asset.brand,
            model: asset.model,
            status: asset.status,
            location: asset.location,
            serialNumber: asset.serialNumber,
            department: asset.department,
            office: asset.office,
            purchaseDate: asset.purchaseDate,
            warrantyEnd: asset.warrantyEnd,
            assignedToId: asset.assignedToId || '',
          }),
        )
        .catch(() => showToast(t('assets.form.load_error')))
    }
  }, [assetId, isEdit, t])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        await updateAsset(assetId, form)
        showToast(t('assets.form.update_success'), 'success')
      } else {
        await createAsset(form)
        showToast(t('assets.form.create_success'), 'success')
      }
      setTimeout(() => navigate('/assets'), 1000)
    } catch (err) {
      showToast(err.response?.data?.message || t('assets.form.save_error'))
    } finally {
      setSaving(false)
    }
  }

  const translateType = (type) => t(`assets.type.${type}`, { defaultValue: type })
  const translateStatus = (status) => t(`assets.status.${status}`, { defaultValue: status })

  return (
    <CRow>
      <CToaster ref={toaster} push={toast} placement="top-end" />
      <CCol xs={12}>
        <CCard>
          <CCardHeader>
            <strong>{isEdit ? t('assets.form.edit_title') : t('assets.form.add_title')}</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>
              <h6 className="text-muted text-uppercase small mb-3 mt-1">{t('assets.sections.identification')}</h6>
              <CRow className="g-3 mb-4">
                <CCol md={3}>
                  <CFormInput
                    label={t('assets.fields.asset_tag_required')}
                    name="assetTag"
                    value={form.assetTag}
                    onChange={handleChange}
                    required
                  />
                </CCol>
                <CCol md={3}>
                  <CFormInput
                    label={t('assets.fields.serial_number')}
                    name="serialNumber"
                    value={form.serialNumber}
                    onChange={handleChange}
                  />
                </CCol>
                <CCol md={3}>
                  <CFormSelect label={t('assets.fields.type_required')} name="type" value={form.type} onChange={handleChange} required>
                    <option value="">{t('common.select')}</option>
                    {TYPES.map((type) => (
                      <option key={type} value={type}>
                        {translateType(type)}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={3}>
                  <CFormSelect label={t('assets.fields.status')} name="status" value={form.status} onChange={handleChange}>
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {translateStatus(status)}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={4}>
                  <CFormInput label={t('assets.fields.brand_required')} name="brand" value={form.brand} onChange={handleChange} required />
                </CCol>
                <CCol md={4}>
                  <CFormInput label={t('assets.fields.model_required')} name="model" value={form.model} onChange={handleChange} required />
                </CCol>
                <CCol md={4}>
                  <CFormInput
                    label={t('assets.fields.location')}
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder={t('assets.form.location_placeholder')}
                  />
                </CCol>
              </CRow>

              <h6 className="text-muted text-uppercase small mb-3">{t('assets.sections.assignment')}</h6>
              <CRow className="g-3 mb-4">
                <CCol md={4}>
                  <CFormSelect
                    label={t('assets.fields.assigned_user')}
                    name="assignedToId"
                    value={form.assignedToId}
                    onChange={handleChange}
                  >
                    <option value="">{t('assets.common.unassigned')}</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username} ({user.role_name})
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={4}>
                  <CFormInput
                    label={t('assets.fields.department_service')}
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    placeholder={t('assets.form.department_placeholder')}
                  />
                </CCol>
                <CCol md={4}>
                  <CFormInput
                    label={t('assets.fields.office')}
                    name="office"
                    value={form.office}
                    onChange={handleChange}
                    placeholder={t('assets.form.office_placeholder')}
                  />
                </CCol>
              </CRow>

              <h6 className="text-muted text-uppercase small mb-3">{t('assets.sections.warranty_purchase')}</h6>
              <CRow className="g-3 mb-4">
                <CCol md={6}>
                  <CFormInput
                    type="date"
                    label={t('assets.fields.purchase_date')}
                    name="purchaseDate"
                    value={form.purchaseDate}
                    onChange={handleChange}
                  />
                </CCol>
                <CCol md={6}>
                  <CFormInput
                    type="date"
                    label={t('assets.fields.warranty_end')}
                    name="warrantyEnd"
                    value={form.warrantyEnd}
                    onChange={handleChange}
                  />
                </CCol>
              </CRow>

              <div className="d-flex gap-2">
                <CButton type="submit" color="primary" disabled={saving}>
                  {saving ? t('common.saving') : isEdit ? t('assets.form.update') : t('assets.form.create')}
                </CButton>
                <CButton color="secondary" onClick={() => navigate('/assets')}>
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

export default AssetForm
