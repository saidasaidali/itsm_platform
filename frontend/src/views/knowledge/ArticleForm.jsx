// src/views/knowledge/ArticleForm.jsx
import React, { useEffect, useState, useContext, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CAlert, CButton, CCard, CCardBody, CCardHeader,
  CCol, CForm, CFormInput, CFormSelect, CFormTextarea,
  CRow, CToast, CToastBody, CToaster, CToastHeader,
} from '@coreui/react'
import { createArticle, updateArticle, getArticleById } from '../../services/knowledgeService'

const CATEGORIES = ['Procédures', 'Solutions techniques', 'FAQ', 'Documentation matériel']

const ArticleForm = () => {
  const { articleId } = useParams()
  const isEdit        = Boolean(articleId)
  const navigate      = useNavigate()
  const { currentUser } = useContext(AuthContext)
  const role    = currentUser?.role
  const toaster = useRef()

  const [toast,   addToast]  = useState(0)
  const [saving,  setSaving] = useState(false)
  const [keywordInput, setKeywordInput] = useState('')

  const [form, setForm] = useState({
    title:    '',
    summary:  '',
    content:  '',
    category: 'Procédures',
    keywords: [],
  })

  const showToast = (message, color = 'danger') => {
    addToast(
      <CToast color={color} autohide delay={4000}>
        <CToastHeader closeButton>
          <strong className="me-auto">Article</strong>
        </CToastHeader>
        <CToastBody className={color === 'danger' ? 'text-white' : ''}>
          {message}
        </CToastBody>
      </CToast>
    )
  }

  useEffect(() => {
    if (isEdit) {
      getArticleById(articleId)
        .then((a) => setForm({
          title:    a.title,
          summary:  a.summary,
          content:  a.content,
          category: a.category,
          keywords: a.keywords || [],
        }))
        .catch(() => showToast('Erreur lors du chargement.'))
    }
  }, [isEdit, articleId])

  // Bloquer si pas le bon rôle
  if (role !== 'Admin' && role !== 'Technicien') {
    return <CAlert color="warning">Réservé aux techniciens et administrateurs.</CAlert>
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // Ajouter un mot-clé en appuyant Entrée ou virgule
  const handleKeywordKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const kw = keywordInput.trim().toLowerCase()
      if (kw && !form.keywords.includes(kw)) {
        setForm((prev) => ({ ...prev, keywords: [...prev.keywords, kw] }))
      }
      setKeywordInput('')
    }
  }

  const removeKeyword = (kw) => {
    setForm((prev) => ({ ...prev, keywords: prev.keywords.filter((k) => k !== kw) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Ajouter le dernier mot-clé non validé
    const finalKeywords = keywordInput.trim()
      ? [...form.keywords, keywordInput.trim().toLowerCase()]
      : form.keywords

    setSaving(true)
    try {
      if (isEdit) {
        await updateArticle(articleId, { ...form, keywords: finalKeywords })
        showToast('Article mis à jour.', 'success')
      } else {
        await createArticle({ ...form, keywords: finalKeywords })
        showToast('Article publié.', 'success')
      }
      setTimeout(() => navigate('/knowledge'), 1000)
    } catch (err) {
      showToast(err.response?.data?.message || 'Erreur lors de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CRow className="justify-content-center">
      <CToaster ref={toaster} push={toast} placement="top-end" />
      <CCol lg={9}>
        <CCard>
          <CCardHeader>
            <strong>{isEdit ? 'Modifier l\'article' : 'Nouvel article'}</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>

              {/* ── Titre + Catégorie ── */}
              <CRow className="mb-3 g-3">
                <CCol md={8}>
                  <CFormInput
                    label="Titre *"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    required
                    placeholder="Titre de l'article..."
                  />
                </CCol>
                <CCol md={4}>
                  <CFormSelect
                    label="Catégorie *"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </CFormSelect>
                </CCol>
              </CRow>

              {/* ── Résumé ── */}
              <div className="mb-3">
                <CFormInput
                  label="Résumé *"
                  name="summary"
                  value={form.summary}
                  onChange={handleChange}
                  required
                  placeholder="Résumé court affiché dans la liste..."
                />
              </div>

              {/* ── Contenu ── */}
              <div className="mb-3">
                <CFormTextarea
                  label="Contenu *"
                  name="content"
                  rows={12}
                  value={form.content}
                  onChange={handleChange}
                  required
                  placeholder={`Rédigez votre article ici...

Exemple de structure :
## Problème
Description du problème...

## Solution
Étapes de résolution...

## Notes
Remarques supplémentaires...`}
                />
              </div>

              {/* ── Mots-clés ── */}
              <div className="mb-4">
                <label className="form-label">
                  Mots-clés <small className="text-muted">(Entrée ou virgule pour valider)</small>
                </label>
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {form.keywords.map((kw) => (
                    <span key={kw}
                      className="badge bg-primary d-flex align-items-center gap-1"
                      style={{ fontSize: '13px' }}>
                      #{kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        style={{
                          background: 'none', border: 'none', color: '#fff',
                          cursor: 'pointer', padding: 0, lineHeight: 1,
                        }}>
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  className="form-control"
                  placeholder="vpn, mot de passe, réseau..."
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                />
              </div>

              <div className="d-flex gap-2">
                <CButton type="submit" color="primary" disabled={saving}>
                  {saving ? 'Publication...' : (isEdit ? 'Mettre à jour' : 'Publier l\'article')}
                </CButton>
                <CButton color="secondary" onClick={() => navigate('/knowledge')}>
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

export default ArticleForm