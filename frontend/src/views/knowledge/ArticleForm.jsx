// src/views/knowledge/ArticleForm.jsx
import React, { useEffect, useState, useContext, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CAlert, CButton, CCard, CCardBody, CCardHeader,
  CCol, CForm, CFormInput, CFormSelect, CFormTextarea,
  CRow, CToast, CToastBody, CToaster, CToastHeader,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilX } from '@coreui/icons'
import { createArticle, updateArticle, getArticleById } from '../../services/knowledgeService'

const CATEGORIES = ['Procédures', 'Solutions techniques', 'FAQ', 'Documentation matériel']

const ArticleForm = () => {
  const { articleId } = useParams()
  const isEdit        = Boolean(articleId)
  const navigate      = useNavigate()
  const { currentUser } = useContext(AuthContext)
  const role    = currentUser?.role
  const toaster = useRef()
  const { t } = useTranslation()

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
        .catch(() => showToast(t('knowledge.form.load_error')))
    }
  }, [isEdit, articleId, t])

  // Bloquer si pas le bon rôle
  if (role !== 'Admin' && role !== 'Technicien') {
    return <CAlert color="warning">{t('knowledge.form.not_allowed')}</CAlert>
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
        showToast(t('knowledge.form.update_success'), 'success')
      } else {
        await createArticle({ ...form, keywords: finalKeywords })
        showToast(t('knowledge.form.create_success'), 'success')
      }
      setTimeout(() => navigate('/knowledge'), 1000)
    } catch (err) {
      showToast(err.message || t('knowledge.form.save_error'))
    } finally {
      setSaving(false)
    }
  }

  const translateCategory = (cat) => t(`knowledge.category.${cat}`, { defaultValue: cat })

  return (
    <CRow className="justify-content-center">
      <CToaster ref={toaster} push={toast} placement="top-end" />
      <CCol lg={9}>
        <CCard>
          <CCardHeader>
            <strong>{isEdit ? t('knowledge.form.edit_title') : t('knowledge.form.add_title')}</strong>
          </CCardHeader>
          <CCardBody>
            <CForm onSubmit={handleSubmit}>

              {/* ── Titre + Catégorie ── */}
              <CRow className="mb-3 g-3">
                <CCol md={8}>
                  <CFormInput
                    label={t('knowledge.form.title_label')}
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    required
                    placeholder={t('knowledge.form.title_placeholder')}
                  />
                </CCol>
                <CCol md={4}>
                  <CFormSelect
                    label={t('knowledge.form.category_label')}
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{translateCategory(c)}</option>
                    ))}
                  </CFormSelect>
                </CCol>
              </CRow>

              {/* ── Résumé ── */}
              <div className="mb-3">
                <CFormInput
                  label={t('knowledge.form.summary_label')}
                  name="summary"
                  value={form.summary}
                  onChange={handleChange}
                  required
                  placeholder={t('knowledge.form.summary_placeholder')}
                />
              </div>

              {/* ── Contenu ── */}
              <div className="mb-3">
                <CFormTextarea
                  label={t('knowledge.form.content_label')}
                  name="content"
                  rows={12}
                  value={form.content}
                  onChange={handleChange}
                  required
                  placeholder={t('knowledge.form.content_placeholder')}
                />
              </div>

              {/* ── Mots-clés ── */}
              <div className="mb-4">
                <label className="form-label">
                  {t('knowledge.form.keywords_label')} <small className="text-muted">{t('knowledge.form.keywords_hint')}</small>
                </label>
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {form.keywords.map((kw) => (
                    <span key={kw}
                      className="badge bg-primary d-flex align-items-center gap-1"
                      style={{ fontSize: '13px' }}>
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        style={{
                          background: 'none', border: 'none', color: '#fff',
                          cursor: 'pointer', padding: 0, lineHeight: 1,
                          display: 'flex', alignItems: 'center',
                        }}>
                        <CIcon icon={cilX} size="sm" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  className="form-control"
                  placeholder={t('knowledge.form.keywords_placeholder')}
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                />
              </div>

              <div className="d-flex gap-2">
                <CButton type="submit" color="primary" disabled={saving}>
                  {saving ? t('knowledge.form.publishing') : (isEdit ? t('knowledge.form.update_btn') : t('knowledge.form.publish_btn'))}
                </CButton>
                <CButton color="secondary" onClick={() => navigate('/knowledge')}>
                  {t('knowledge.form.cancel_btn')}
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