import React, { useEffect, useState, useContext, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CButton, CCard, CCardBody, CCardHeader, CCol, CForm, CAlert,
  CFormInput, CFormSelect, CFormTextarea, CRow,
  CToast, CToastBody, CToaster, CToastHeader,
} from '@coreui/react'
import { createTicket, getTicketById } from '../../services/ticketService'
import { getAssets } from '../../services/assetService'

const CATEGORIES = ['Matériel', 'Logiciel', 'Réseau', 'Accès / Droits', 'Imprimante', 'Autre']

const TicketForm = () => {
  const { ticketId }          = useParams()
  const [searchParams]        = useSearchParams()
  const isEdit                = Boolean(ticketId)
  const navigate              = useNavigate()
  const { currentUser }       = useContext(AuthContext)
  const toaster               = useRef()
  const [toast, addToast]     = useState(0)
  const [saving, setSaving]   = useState(false)
  const [assets, setAssets]   = useState([])

  // Pré-sélection depuis AssetDetail (?assetId=X)
  const preselectedAssetId = searchParams.get('assetId') || ''

  const [form, setForm] = useState({
    title:       '',
    description: '',
    priority:    'Moyenne',
    category:    '',
    assetId:     preselectedAssetId,
  })

  const showToast = (message, color = 'danger') => {
    addToast(
      <CToast color={color} autohide delay={4000}>
        <CToastHeader closeButton>
          <strong className="me-auto">Notification</strong>
        </CToastHeader>
        <CToastBody className={color === 'danger' ? 'text-white' : ''}>
          {message}
        </CToastBody>
      </CToast>
    )
  }

  useEffect(() => {
    // Charger la liste des équipements pour l'agent
    getAssets().catch(console.error).then((data) => setAssets(data || []))

    if (isEdit) {
      getTicketById(ticketId)
        .then((t) => setForm({
          title:       t.title,
          description: t.description,
          priority:    t.priority,
          category:    t.category,
          assetId:     t.assetId || '',
        }))
        .catch(() => showToast('Erreur lors du chargement.'))
    }
  }, [isEdit, ticketId])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (currentUser?.role !== 'Agent') {
      showToast('Seul un agent peut créer un ticket.')
      return
    }
    setSaving(true)
    try {
      await createTicket(form)
      showToast('Ticket créé avec succès.', 'success')
      setTimeout(() => navigate('/tickets'), 1000)
    } catch (err) {
      showToast(err.response?.data?.message || 'Une erreur est survenue.')
    } finally {
      setSaving(false)
    }
  }

  if (currentUser?.role !== 'Agent') {
    return <CAlert color="warning">La création de tickets est réservée aux agents.</CAlert>
  }

  return (
    <CRow>
      <CToaster ref={toaster} push={toast} placement="top-end" />
      <CCol xs={12}>
        <CCard>
          <CCardHeader><strong>Nouveau ticket</strong></CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>
              <CRow className="mb-3">
                <CCol md={8}>
                  <CFormInput
                    label="Titre *"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    required
                    placeholder="Décrivez brièvement le problème"
                  />
                </CCol>
                <CCol md={4}>
                  <CFormSelect
                    label="Priorité"
                    name="priority"
                    value={form.priority}
                    onChange={handleChange}
                  >
                    <option value="Haute">Haute (SLA 4h)</option>
                    <option value="Moyenne">Moyenne (SLA 24h)</option>
                    <option value="Basse">Basse (SLA 72h)</option>
                  </CFormSelect>
                </CCol>
              </CRow>

              <CRow className="mb-3">
                <CCol md={4}>
                  <CFormSelect
                    label="Catégorie"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                  >
                    <option value="">-- Sélectionner --</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </CFormSelect>
                </CCol>

                {/* ── Équipement concerné ── */}
                <CCol md={8}>
                  <CFormSelect
                    label="Équipement concerné (optionnel)"
                    name="assetId"
                    value={form.assetId}
                    onChange={handleChange}
                  >
                    <option value="">-- Aucun équipement --</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.assetTag} — {a.brand} {a.model}
                        {a.assignedTo ? ` (affecté à ${a.assignedTo})` : ''}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
              </CRow>

              <CRow className="mb-3">
                <CCol md={12}>
                  <CFormTextarea
                    label="Description *"
                    name="description"
                    rows={5}
                    value={form.description}
                    onChange={handleChange}
                    required
                    placeholder="Décrivez le problème en détail..."
                  />
                </CCol>
              </CRow>

              <div className="d-flex gap-2">
                <CButton type="submit" color="primary" disabled={saving}>
                  {saving ? 'Création en cours...' : 'Créer le ticket'}
                </CButton>
                <CButton color="secondary" onClick={() => navigate('/tickets')}>
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

export default TicketForm