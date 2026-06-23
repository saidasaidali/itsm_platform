// src/services/knowledgeService.js
import api from './api.js'
import i18n from '../i18n'

const mapArticle = (a) => ({
  id:          a.id,
  title:       a.title,
  summary:     a.summary,
  content:     a.content,
  category:    a.category,
  keywords:    a.keywords || [],
  author:      a.author_name || i18n.t('knowledge_meta.default_author'),
  authorId:    a.author_id || null,
  viewsCount:  a.views_count || 0,
  isPublished: a.is_published !== false,
  createdAt:   a.created_at?.split('T')[0] || '',
  updatedAt:   a.updated_at?.split('T')[0] || '',
})

export const getArticles = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString()
  const data = await api.get(`/api/knowledge${params ? `?${params}` : ''}`)
  return data.data.map(mapArticle)
}

export const getArticleById = async (id) => {
  const data = await api.get(`/api/knowledge/${id}`)
  return mapArticle(data.data)
}

export const searchKnowledge = async (q) => {
  const data = await api.get(`/api/knowledge/search?q=${encodeURIComponent(q)}`)
  return data.data.map(mapArticle)
}

export const createArticle = async (article) => {
  const data = await api.post('/api/knowledge', {
    title:    article.title,
    summary:  article.summary,
    content:  article.content,
    category: article.category,
    keywords: article.keywords,
  })
  return data.data
}

export const updateArticle = async (id, updates) => {
  const data = await api.put(`/api/knowledge/${id}`, {
    title:        updates.title,
    summary:      updates.summary,
    content:      updates.content,
    category:     updates.category,
    keywords:     updates.keywords,
    is_published: updates.isPublished,
  })
  return data.data
}

export const deleteArticle = async (id) => {
  const data = await api.delete(`/api/knowledge/${id}`)
  return data
}