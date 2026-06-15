// src/views/knowledge/Article.jsx
import React, { useEffect, useState, useContext } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthContext } from '../../auth/AuthProvider'
import {
  CAlert, CBadge, CButton, CCard, CCardBody,
  CCardHeader, CCol, CRow, CSpinner,
} from '@coreui/react'
import { getArticleById, deleteArticle } from '../../services/knowledgeService'

const CATEGORY_COLORS = {
  'Procédures':             'primary',
  'Solutions techniques':   'success',
  'FAQ':                    'info',
  'Documentation matériel': 'warning',
}

const Article = () => {
  const { articleId } = useParams()
  const navigate      = useNavigate()
  const { currentUser } = useContext(AuthContext)
  const role = currentUser?.role

  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    getArticleById(articleId)
      .then(setArticle)
      .catch(() => setError('Article introuvable.'))
      .finally(() => setLoading(false))
  }, [articleId])

  const handleDelete = async () => {
    if (!window.confirm('Supprimer cet article définitivement ?')) return
    try {
      await deleteArticle(articleId)
      navigate('/knowledge')
    } catch (e) {
      setError(e.response?.data?.message || 'Erreur lors de la suppression.')
    }
  }

  if (loading) return <div className="text-center p-5"><CSpinner /></div>
  if (error)   return <CAlert color="danger">{error}</CAlert>
  if (!article) return <CAlert color="warning">Article introuvable.</CAlert>

  const canEdit = role === 'Admin' ||
    (role === 'Technicien' && article.authorId === currentUser?.id)

  return (
    <CRow className="justify-content-center">
      <CCol lg={9}>
        <CCard>
          <CCardHeader className="d-flex justify-content-between align-items-start">
            <div>
              <CBadge color={CATEGORY_COLORS[article.category] || 'secondary'} className="mb-2">
                {article.category}
              </CBadge>
              <h4 className="mb-0">{article.title}</h4>
              <small className="text-muted">
                Par <strong>{article.author}</strong> • Mis à jour le {article.updatedAt}
                {' '}• 👁 {article.viewsCount} vue(s)
              </small>
            </div>
            <div className="d-flex gap-2 ms-3 flex-shrink-0">
              <CButton color="secondary" size="sm" onClick={() => navigate('/knowledge')}>
                ← Retour
              </CButton>
              {canEdit && (
                <CButton color="primary" size="sm"
                  onClick={() => navigate(`/knowledge/${articleId}/edit`)}>
                  Modifier
                </CButton>
              )}
              {role === 'Admin' && (
                <CButton color="danger" size="sm" onClick={handleDelete}>
                  Supprimer
                </CButton>
              )}
            </div>
          </CCardHeader>

          <CCardBody>
            {/* Résumé */}
            <div className="p-3 mb-4 rounded"
              style={{ background: 'rgba(0,0,0,0.03)', borderLeft: '4px solid #3b82f6' }}>
              <strong>Résumé :</strong> {article.summary}
            </div>

            {/* Contenu — rendu avec sauts de ligne */}
            <div style={{ lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
              {article.content}
            </div>

            {/* Mots-clés */}
            {article.keywords?.length > 0 && (
              <div className="mt-4 pt-3 border-top">
                <strong className="text-muted small text-uppercase">Mots-clés :</strong>
                <div className="d-flex flex-wrap gap-2 mt-2">
                  {article.keywords.map((kw) => (
                    <span key={kw} className="badge bg-light text-dark border px-2 py-1">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default Article