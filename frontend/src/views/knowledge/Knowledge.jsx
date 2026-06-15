// src/views/knowledge/Knowledge.jsx
import React, { useEffect, useState, useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CBadge, CButton, CCard, CCardBody, CCol,
  CFormSelect, CInputGroup, CInputGroupText, CRow, CSpinner,
} from '@coreui/react'
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
        a.summary.toLowerCase().includes(q) ||
        a.keywords.some((k) => k.includes(q))
      const matchCat = category === 'Tous' || a.category === category
      return matchSearch && matchCat
    })
  }, [articles, search, category])

  return (
    <>
      {/* ── En-tête ── */}
      <CRow className="mb-4 align-items-center">
        <CCol>
          <h3 className="mb-0">Base de connaissances</h3>
          <small className="text-muted">{articles.length} article(s) disponible(s)</small>
        </CCol>
        {(role === 'Admin' || role === 'Technicien') && (
          <CCol xs="auto">
            <CButton color="primary" onClick={() => navigate('/knowledge/new')}>
              + Nouvel article
            </CButton>
          </CCol>
        )}
      </CRow>

      {/* ── Filtres ── */}
      <CRow className="mb-4 g-2">
        <CCol md={6}>
          <CInputGroup>
            <CInputGroupText>🔍</CInputGroupText>
            <input
              className="form-control"
              placeholder="Rechercher par titre, résumé ou mot-clé..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <CButton color="outline-secondary" onClick={() => setSearch('')}>✕</CButton>
            )}
          </CInputGroup>
        </CCol>
        <CCol md={4}>
          <CFormSelect value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </CFormSelect>
        </CCol>
      </CRow>

      {/* ── Grille d'articles ── */}
      {loading ? (
        <div className="text-center p-5"><CSpinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted p-5">
          {articles.length === 0
            ? 'Aucun article publié pour le moment.'
            : 'Aucun article ne correspond à votre recherche.'}
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
                  {/* Catégorie */}
                  <div className="mb-2">
                    <CBadge color={CATEGORY_COLORS[article.category] || 'secondary'}>
                      {article.category}
                    </CBadge>
                  </div>

                  {/* Titre */}
                  <h6 className="fw-bold mb-2">{article.title}</h6>

                  {/* Résumé */}
                  <p className="text-muted small flex-grow-1" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {article.summary}
                  </p>

                  {/* Mots-clés */}
                  {article.keywords?.length > 0 && (
                    <div className="mb-2 d-flex flex-wrap gap-1">
                      {article.keywords.slice(0, 4).map((kw) => (
                        <span key={kw} className="badge bg-light text-dark border"
                          style={{ fontSize: '10px' }}>
                          #{kw}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                    <small className="text-muted">
                      {article.author} • {article.updatedAt}
                    </small>
                    <small className="text-muted">👁 {article.viewsCount}</small>
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