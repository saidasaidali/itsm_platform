// src/views/assets/AssetForm.jsx
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CButton, CCard, CCardBody, CCardHeader, CCol, CForm,
  CFormInput, CFormSelect, CRow,
  CToast, CToastBody, CToaster, CToastHeader,
} from '@coreui/react'
import { createAsset, updateAsset, getAssetById } from '../../services/assetService'
import { getUsers } from '../../services/userService'

const TYPES = ['Ordinateur portable','Ordinateur fixe','Imprimante','Écran','Téléphone','Switch','Serveur','Autre']

const AssetForm = () => {
  const { assetId } = useParams()
  const isEdit = Boolean(assetId)
  const navigate = useNavigate()
  const toaster = useRef()
  const [toast, addToast] = useState(0)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState([])

  const [form, setForm] = useState({
    assetTag: '', type: '', brand: '', model: '',
    status: 'En service', location: '',
    serialNumber: '', department: '', office: '',
    purchaseDate: '', warrantyEnd: '',
    assignedToId: '',
  })

  const showToast = (message, color = 'danger') => {
    addToast(
      <CToast color={color} autohide delay={4000}>
        <CToastHeader closeButton><strong className="me-auto">Équipement</strong></CToastHeader>
        <CToastBody className={color === 'danger' ? 'text-white' : ''}>{message}</CToastBody>
      </CToast>
    )
  }

  useEffect(() => {
    getUsers().then(setUsers).catch(console.error)
    if (isEdit) {
      getAssetById(assetId)
        .then((a) => setForm({
          assetTag:     a.assetTag,
          type:         a.type,
          brand:        a.brand,
          model:        a.model,
          status:       a.status,
          location:     a.location,
          serialNumber: a.serialNumber,
          department:   a.department,
          office:       a.office,
          purchaseDate: a.purchaseDate,
          warrantyEnd:  a.warrantyEnd,
          assignedToId: a.assignedToId || '',
        }))
        .catch(() => showToast('Erreur lors du chargement.'))
    }
  }, [assetId, isEdit])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        await updateAsset(assetId, form)
        showToast('Équipement mis à jour.', 'success')
      } else {
        await createAsset(form)
        showToast('Équipement créé.', 'success')
      }
      setTimeout(() => navigate('/assets'), 1000)
    } catch (err) {
      showToast(err.response?.data?.message || 'Erreur lors de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CRow>
      <CToaster ref={toaster} push={toast} placement="top-end" />
      <CCol xs={12}>
        <CCard>
          <CCardHeader>
            <strong>{isEdit ? 'Modifier l\'équipement' : 'Ajouter un équipement'}</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>

              {/* ── Identification ── */}
              <h6 className="text-muted text-uppercase small mb-3 mt-1">Identification</h6>
              <CRow className="g-3 mb-4">
                <CCol md={3}>
                  <CFormInput label="Tag asset *" name="assetTag"
                    value={form.assetTag} onChange={handleChange} required />
                </CCol>
                <CCol md={3}>
                  <CFormInput label="N° de série" name="serialNumber"
                    value={form.serialNumber} onChange={handleChange} />
                </CCol>
                <CCol md={3}>
                  <CFormSelect label="Type *" name="type"
                    value={form.type} onChange={handleChange} required>
                    <option value="">-- Sélectionner --</option>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </CFormSelect>
                </CCol>
                <CCol md={3}>
                  <CFormSelect label="Statut" name="status"
                    value={form.status} onChange={handleChange}>
                    <option value="En service">En service</option>
                    <option value="En panne">En panne</option>
                    <option value="En maintenance">En maintenance</option>
                    <option value="Retiré">Retiré</option>
                  </CFormSelect>
                </CCol>
                <CCol md={4}>
                  <CFormInput label="Marque *" name="brand"
                    value={form.brand} onChange={handleChange} required />
                </CCol>
                <CCol md={4}>
                  <CFormInput label="Modèle *" name="model"
                    value={form.model} onChange={handleChange} required />
                </CCol>
                <CCol md={4}>
                  <CFormInput label="Emplacement" name="location"
                    value={form.location} onChange={handleChange}
                    placeholder="Salle 101, Bâtiment A..." />
                </CCol>
              </CRow>

              {/* ── Affectation ── */}
              <h6 className="text-muted text-uppercase small mb-3">Affectation</h6>
              <CRow className="g-3 mb-4">
                <CCol md={4}>
                  <CFormSelect label="Affecté à (utilisateur)" name="assignedToId"
                    value={form.assignedToId} onChange={handleChange}>
                    <option value="">-- Non affecté --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.role_name})
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol md={4}>
                  <CFormInput label="Direction / Service" name="department"
                    value={form.department} onChange={handleChange}
                    placeholder="DSI, RH, Finance..." />
                </CCol>
                <CCol md={4}>
                  <CFormInput label="Bureau" name="office"
                    value={form.office} onChange={handleChange}
                    placeholder="Bureau 203..." />
                </CCol>
              </CRow>

              {/* ── Garantie ── */}
              <h6 className="text-muted text-uppercase small mb-3">Garantie & Achat</h6>
              <CRow className="g-3 mb-4">
                <CCol md={6}>
                  <CFormInput type="date" label="Date d'achat" name="purchaseDate"
                    value={form.purchaseDate} onChange={handleChange} />
                </CCol>
                <CCol md={6}>
                  <CFormInput type="date" label="Fin de garantie" name="warrantyEnd"
                    value={form.warrantyEnd} onChange={handleChange} />
                </CCol>
              </CRow>

              <div className="d-flex gap-2">
                <CButton type="submit" color="primary" disabled={saving}>
                  {saving ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Créer l\'équipement')}
                </CButton>
                <CButton color="secondary" onClick={() => navigate('/assets')}>
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

export default AssetForm