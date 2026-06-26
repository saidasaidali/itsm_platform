// src/views/knowledge/Knowledge.jsx
import React, { useEffect, useState, useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CBadge, CButton, CCard, CCardBody, CCol,
  CFormSelect, CInputGroup, CInputGroupText, CRow, CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilX, cilViewModule } from '@coreui/icons'
import { getArticles } from '../../services/knowledgeService'

const CATEGORIES = ['Tous', 'Procédures', 'Solutions techniques', 'FAQ', 'Documentation matériel']

const CATEGORY_COLORS = {
  'Procédures':             'primary',
  'Solutions techniques':   'success',
  'FAQ':                    'info',
  'Documentation matériel': 'warning',
}

const Knowledge = () => {
  const navigate = useNavigate()
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role
  const { t } = useTranslation()

  const [articles,  setArticles]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [category,  setCategory]  = useState('Tous')

  useEffect(() => {
    getArticles()
      .then(setArticles)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return articles.filter((a) => {
      const matchSearch = !q ||
        a.title.toLowerCase().includes(q) ||
        a.summary?.toLowerCase().includes(q) ||
        a.keywords?.some((k) => k.toLowerCase().includes(q))
      const matchCat = category === 'Tous' || a.category === category
      return matchSearch && matchCat
    })
  }, [articles, search, category])

  const translateCategory = (cat) => t(`knowledge.category.${cat}`, { defaultValue: cat })

  return (
    <>
      <CRow className="mb-4 align-items-center">
        <CCol>
          <h3 className="mb-0">{t('knowledge.title')}</h3>
          <small className="text-muted">{t('knowledge.available_articles', { count: articles.length })}</small>
        </CCol>
        {(role === 'Admin' || role === 'Technicien') && (
          <CCol xs="auto" className="d-flex gap-2">
            <CButton color="primary" onClick={() => navigate('/knowledge/new')}>
              {t('knowledge.new_article')}
            </CButton>
            <CButton color="info" onClick={() => navigate('/knowledge/import')}>
              {t('knowledge.import_articles.button')}
            </CButton>
          </CCol>
        )}
      </CRow>

      <CRow className="mb-4 g-2">
        <CCol md={6}>
          <CInputGroup>
            <CInputGroupText><CIcon icon={cilSearch} /></CInputGroupText>
            <input
              className="form-control"
              placeholder={t('knowledge.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <CButton color="outline-secondary" onClick={() => setSearch('')}>
                <CIcon icon={cilX} size="sm" />
              </CButton>
            )}
          </CInputGroup>
        </CCol>
        <CCol md={4}>
          <CFormSelect value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{translateCategory(c)}</option>)}
          </CFormSelect>
        </CCol>
      </CRow>

      {loading ? (
        <div className="text-center p-5"><CSpinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted p-5">
          {articles.length === 0
            ? t('knowledge.empty_published')
            : t('knowledge.empty_search')}
        </div>
      ) : (
        <CRow className="g-4">
          {filtered.map((article) => (
            <CCol xs={12} md={6} xl={4} key={article.id}>
              <CCard className="h-100 shadow-sm"
                style={{ cursor: 'pointer', transition: 'transform 0.15s' }}
                onClick={() => navigate(`/knowledge/${article.id}`)}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <CCardBody className="d-flex flex-column">
                  <div className="mb-2">
                    <CBadge color={CATEGORY_COLORS[article.category] || 'secondary'}>
                      {translateCategory(article.category)}
                    </CBadge>
                  </div>

                  <h6 className="fw-bold mb-2">{article.title}</h6>

                  <p className="text-muted small flex-grow-1" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {article.summary}
                  </p>

                  {article.keywords?.length > 0 && (
                    <div className="mb-2 d-flex flex-wrap gap-1">
                      {article.keywords.slice(0, 4).map((kw) => (
                        <span key={kw} className="badge bg-light text-dark border"
                          style={{ fontSize: '10px' }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                    <small className="text-muted">
                      {article.author} • {article.updatedAt}
                    </small>
                    <small className="text-muted d-flex align-items-center gap-1">
                      <CIcon icon={cilViewModule} size="sm" />
                      {article.viewsCount ?? 0}
                    </small>
                  </div>
                </CCardBody>
              </CCard>
            </CCol>
          ))}
        </CRow>
      )}
    </>
  )
}

export default Knowledge